"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import {
  canManageCalendarEvent,
  formatCalendarDay,
  isCalendarEventType,
  isCalendarTime,
  isCalendarVisibility,
  parseCalendarDay,
  type CalendarEventType,
  type CalendarVisibility,
} from "@/lib/calendar";
import { createNotification } from "@/lib/notifications";

/** The title column is a VARCHAR(191). */
const MAX_TITLE_LENGTH = 191;
const MAX_NOTES_LENGTH = 5000;

/**
 * Returned to the dialog rather than thrown: a thrown error reaches the
 * browser as a generic message in production, and the dialog would lose what
 * was typed into it. `date` is the day saved, so the calendar can show it.
 */
export type CalendarFormState = { ok: true; date: string } | { error: string } | null;

type CalendarEntryInput = {
  title: string;
  type: CalendarEventType;
  /** "YYYY-MM-DD". */
  day: string;
  date: Date;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  visibility: CalendarVisibility;
};

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function getSessionUser() {
  const session = await auth();
  const sessionUser = session?.user as
    | (NonNullable<typeof session>["user"] & {
        id?: string;
        role?: string;
      })
    | undefined;

  if (!sessionUser?.id) {
    redirect("/login");
  }

  return sessionUser as typeof sessionUser & { id: string };
}

function readEntry(
  formData: FormData
): { error: string } | CalendarEntryInput {
  const title = getValue(formData, "title");
  const type = getValue(formData, "type");
  const day = getValue(formData, "date");
  const startTime = getValue(formData, "startTime");
  const endTime = getValue(formData, "endTime");
  const notes = getValue(formData, "notes");
  const visibility = getValue(formData, "visibility");
  const date = parseCalendarDay(day);

  if (!title) {
    return { error: "Give the entry a title." };
  }

  if (title.length > MAX_TITLE_LENGTH) {
    return { error: `Keep the title under ${MAX_TITLE_LENGTH} characters.` };
  }

  if (!isCalendarEventType(type)) {
    return { error: "Select what kind of entry this is." };
  }

  if (!date) {
    return { error: "Select a valid date." };
  }

  if (startTime && !isCalendarTime(startTime)) {
    return { error: "Enter a valid start time." };
  }

  if (endTime && !startTime) {
    return { error: "Add a start time before an end time." };
  }

  if (endTime && !isCalendarTime(endTime)) {
    return { error: "Enter a valid end time." };
  }

  // Both are zero-padded "HH:MM", so they compare as text.
  if (endTime && endTime <= startTime) {
    return { error: "The end time has to be after the start time." };
  }

  if (notes.length > MAX_NOTES_LENGTH) {
    return { error: `Keep the notes under ${MAX_NOTES_LENGTH} characters.` };
  }

  if (!isCalendarVisibility(visibility)) {
    return { error: "Choose who can see this entry." };
  }

  return {
    title,
    type,
    day,
    date,
    startTime: startTime || null,
    endTime: endTime || null,
    notes: notes || null,
    visibility,
  };
}

/**
 * The people a "selected" entry is posted with: each once, never its author,
 * and only people who exist. Empty for the other kinds.
 */
async function resolveShareIds(
  formData: FormData,
  visibility: CalendarVisibility,
  authorId: string
): Promise<{ error: string } | string[]> {
  if (visibility !== "selected") {
    return [];
  }

  const ids = [
    ...new Set(
      formData
        .getAll("sharedWith")
        .filter((value): value is string => typeof value === "string" && value !== "")
    ),
  ].filter((id) => id !== authorId);

  if (ids.length === 0) {
    return { error: "Pick at least one person to share it with." };
  }

  const found = await prisma.user.count({ where: { id: { in: ids } } });

  if (found !== ids.length) {
    return { error: "Someone you picked is no longer here. Pick again." };
  }

  return ids;
}

/**
 * Tells the people newly added to a "selected" entry. Best effort: the entry
 * is already saved, so a failed notification is not reported as a failed save.
 */
async function notifySharedWith(
  ids: string[],
  previousIds: string[],
  actorName: string | null | undefined,
  entry: { title: string; day: string }
) {
  const previous = new Set(previousIds);

  for (const userId of ids) {
    if (previous.has(userId)) {
      continue;
    }

    try {
      await createNotification({
        userId,
        title: "Calendar entry shared",
        message: `${actorName ?? "Someone"} shared "${entry.title}" on ${formatCalendarDay(entry.day)} with you.`,
        type: "CALENDAR_SHARED",
      });
    } catch (error) {
      console.error("Could not send a calendar share notification", error);
    }
  }
}

/**
 * The activity log line for an entry. Admins and managers read the log, so an
 * entry not shared with everyone is logged without its title.
 */
function describeEntry(verb: string, title: string, visibility: string) {
  if (visibility === "everyone") {
    return `${verb} calendar entry ${title}`;
  }

  return visibility === "selected"
    ? `${verb} a calendar entry shared with selected people`
    : `${verb} a private calendar entry`;
}

/** Adds an entry, or saves changes to one when the form carries an id. */
export async function saveCalendarEvent(
  _previous: CalendarFormState,
  formData: FormData
): Promise<CalendarFormState> {
  const sessionUser = await getSessionUser();
  const id = getValue(formData, "id");
  const entry = readEntry(formData);

  if ("error" in entry) {
    return { error: entry.error };
  }

  const fields = {
    title: entry.title,
    type: entry.type,
    date: entry.date,
    startTime: entry.startTime,
    endTime: entry.endTime,
    notes: entry.notes,
  };

  // Who it ends up shared with, and with whom before: the difference is told
  // once the save is through.
  let shareIds: string[] = [];
  let previousShareIds: string[] = [];

  try {
    if (id) {
      const existing = await prisma.calendarEvent.findUnique({
        where: { id },
        select: {
          createdById: true,
          visibility: true,
          shares: { select: { userId: true } },
        },
      });

      if (!existing) {
        return { error: "This entry no longer exists." };
      }

      if (!canManageCalendarEvent(sessionUser, existing)) {
        return { error: "You can only change entries you added." };
      }

      // Who sees an entry is its author's call. An admin tidying up someone
      // else's shared entry leaves it shared, with the same people.
      const isAuthor = existing.createdById === sessionUser.id;
      const visibility = isAuthor ? entry.visibility : existing.visibility;

      if (isAuthor) {
        const resolved = await resolveShareIds(formData, entry.visibility, sessionUser.id);

        if (!Array.isArray(resolved)) {
          return { error: resolved.error };
        }

        shareIds = resolved;
        previousShareIds = existing.shares.map((share) => share.userId);
      }

      await prisma.$transaction([
        ...(isAuthor
          ? [prisma.calendarEventShare.deleteMany({ where: { eventId: id } })]
          : []),
        prisma.calendarEvent.update({
          where: { id },
          data: {
            ...fields,
            visibility,
            ...(isAuthor
              ? { shares: { create: shareIds.map((userId) => ({ userId })) } }
              : {}),
          },
        }),
      ]);

      await logActivity({
        userId: sessionUser.id,
        action: "updated",
        entityType: "calendar",
        entityId: id,
        description: describeEntry("Updated", entry.title, visibility),
      });
    } else {
      const resolved = await resolveShareIds(formData, entry.visibility, sessionUser.id);

      if (!Array.isArray(resolved)) {
        return { error: resolved.error };
      }

      shareIds = resolved;

      const created = await prisma.calendarEvent.create({
        data: {
          ...fields,
          visibility: entry.visibility,
          createdById: sessionUser.id,
          shares: { create: shareIds.map((userId) => ({ userId })) },
        },
        select: { id: true },
      });

      await logActivity({
        userId: sessionUser.id,
        action: "created",
        entityType: "calendar",
        entityId: created.id,
        description: describeEntry("Added", entry.title, entry.visibility),
      });
    }
  } catch {
    return { error: "Could not save the entry. Please try again." };
  }

  await notifySharedWith(shareIds, previousShareIds, sessionUser.name, entry);

  return { ok: true, date: entry.day };
}

export async function deleteCalendarEvent(
  id: string
): Promise<{ error: string } | null> {
  const sessionUser = await getSessionUser();

  try {
    const existing = await prisma.calendarEvent.findUnique({
      where: { id },
      select: { title: true, createdById: true, visibility: true },
    });

    if (!existing) {
      // Already gone, which is what was asked for.
      return null;
    }

    if (!canManageCalendarEvent(sessionUser, existing)) {
      return { error: "You can only delete entries you added." };
    }

    await prisma.calendarEvent.delete({ where: { id } });

    await logActivity({
      userId: sessionUser.id,
      action: "deleted",
      entityType: "calendar",
      entityId: id,
      description: describeEntry(
        "Deleted",
        existing.title,
        existing.visibility
      ),
    });
  } catch {
    return { error: "Could not delete the entry. Please try again." };
  }

  return null;
}
