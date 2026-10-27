import { prisma } from "@/lib/prisma";
import {
  calendarGridDays,
  canManageCalendarEvent,
  officeToday,
  type CalendarEntry,
} from "@/lib/calendar";
import { getWatcherOptions } from "@/lib/taskWatchers";

type Viewer = { id: string; role?: string };

/**
 * The entries on a month's grid that `viewer` may see: their own, whoever
 * they are shared with, those shared with them, and everything shared with
 * everyone. Ordered by day, all-day entries first (MySQL sorts a null start
 * time ahead of the rest), then by start time.
 */
export async function loadCalendarMonth(
  viewer: Viewer,
  month: string
): Promise<CalendarEntry[]> {
  const days = calendarGridDays(month);
  const events = await prisma.calendarEvent.findMany({
    where: {
      date: {
        gte: new Date(`${days[0]}T00:00:00.000Z`),
        lte: new Date(`${days[days.length - 1]}T00:00:00.000Z`),
      },
      OR: [
        { createdById: viewer.id },
        { visibility: "everyone" },
        { visibility: "selected", shares: { some: { userId: viewer.id } } },
      ],
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      type: true,
      date: true,
      startTime: true,
      endTime: true,
      notes: true,
      visibility: true,
      createdById: true,
      createdBy: { select: { name: true } },
      shares: {
        select: { user: { select: { id: true, name: true } } },
        orderBy: { user: { name: "asc" } },
      },
    },
  });

  return events.map((event) => ({
    id: event.id,
    title: event.title,
    type: event.type,
    date: event.date.toISOString().slice(0, 10),
    startTime: event.startTime,
    endTime: event.endTime,
    notes: event.notes,
    visibility: event.visibility,
    sharedWith: event.shares.map((share) => share.user),
    createdByName: event.createdBy.name,
    isOwn: event.createdById === viewer.id,
    canManage: canManageCalendarEvent(viewer, event),
  }));
}

/**
 * Everything the calendar component starts with: today on the office clock,
 * this month's entries, and the people an entry can be shared with -- the
 * same list a task's watchers are picked from, less the viewer.
 */
export async function loadCalendarProps(viewer: Viewer) {
  const today = officeToday();
  const [initialEntries, everyone] = await Promise.all([
    loadCalendarMonth(viewer, today.slice(0, 7)),
    getWatcherOptions(),
  ]);

  return {
    today,
    initialEntries,
    people: everyone.filter((person) => person.id !== viewer.id),
  };
}
