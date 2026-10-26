"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import {
  canManageCalendarEvent,
  isCalendarEventType,
  isCalendarTime,
  isCalendarVisibility,
  parseCalendarDay,
  type CalendarEventType,
  type CalendarVisibility,
} from "@/lib/calendar";

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
 * The activity log line for an entry. Admins and managers read the log, so a
 * private entry is logged without its title.
 */
function describeEntry(verb: string, title: string, visibility: string) {
  return visibility === "everyone"
    ? `${verb} calendar entry ${title}`
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

  try {
    if (id) {
      const existing = await prisma.calendarEvent.findUnique({
        where: { id },
        select: { createdById: true, visibility: true },
      });

      if (!existing) {
        return { error: "This entry no longer exists." };
      }

      if (!canManageCalendarEvent(sessionUser, existing)) {
        return { error: "You can only change entries you added." };
      }

      // Who sees an entry is its author's call. An admin tidying up someone
      // else's shared entry leaves it shared.
      const visibility =
        existing.createdById === sessionUser.id
          ? entry.visibility
          : existing.visibility;

      await prisma.calendarEvent.update({
        where: { id },
        data: { ...fields, visibility },
      });

      await logActivity({
        userId: sessionUser.id,
        action: "updated",
        entityType: "calendar",
        entityId: id,
        description: describeEntry("Updated", entry.title, visibility),
      });
    } else {
      const created = await prisma.calendarEvent.create({
        data: {
          ...fields,
          visibility: entry.visibility,
          createdById: sessionUser.id,
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
