import { prisma } from "@/lib/prisma";
import {
  calendarGridDays,
  canManageCalendarEvent,
  occurrencesBetween,
  officeToday,
  parseRepeatDays,
  type CalendarEntry,
} from "@/lib/calendar";
import { getWatcherOptions } from "@/lib/taskWatchers";

type Viewer = { id: string; role?: string };

/**
 * The entries on a month's grid that `viewer` may see: their own, whoever
 * they are shared with, those shared with them, and everything shared with
 * everyone. A repeating entry comes once for each day it falls on. Ordered by
 * day, all-day entries first, then by start time.
 */
export async function loadCalendarMonth(
  viewer: Viewer,
  month: string
): Promise<CalendarEntry[]> {
  const days = calendarGridDays(month);
  const from = days[0];
  const to = days[days.length - 1];
  const events = await prisma.calendarEvent.findMany({
    where: {
      AND: [
        {
          OR: [
            { createdById: viewer.id },
            { visibility: "everyone" },
            { visibility: "selected", shares: { some: { userId: viewer.id } } },
          ],
        },
        // Set for a day on the grid, or set earlier and still repeating onto it.
        {
          date: { lte: new Date(`${to}T00:00:00.000Z`) },
          OR: [
            { date: { gte: new Date(`${from}T00:00:00.000Z`) } },
            {
              recurrence: { not: "none" },
              OR: [
                { repeatUntil: null },
                { repeatUntil: { gte: new Date(`${from}T00:00:00.000Z`) } },
              ],
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      title: true,
      type: true,
      date: true,
      startTime: true,
      endTime: true,
      recurrence: true,
      repeatDays: true,
      repeatMonthDay: true,
      repeatUntil: true,
      notes: true,
      visibility: true,
      createdById: true,
      createdAt: true,
      createdBy: { select: { name: true } },
      shares: {
        select: { user: { select: { id: true, name: true } } },
        orderBy: { user: { name: "asc" } },
      },
    },
  });

  return events
    .flatMap((event) => {
      const seriesDate = event.date.toISOString().slice(0, 10);
      const entry = {
        id: event.id,
        title: event.title,
        type: event.type,
        seriesDate,
        recurrence: event.recurrence,
        repeatDays: parseRepeatDays(event.repeatDays),
        repeatMonthDay: event.repeatMonthDay,
        repeatUntil: event.repeatUntil?.toISOString().slice(0, 10) ?? null,
        startTime: event.startTime,
        endTime: event.endTime,
        notes: event.notes,
        visibility: event.visibility,
        sharedWith: event.shares.map((share) => share.user),
        createdByName: event.createdBy.name,
        isOwn: event.createdById === viewer.id,
        canManage: canManageCalendarEvent(viewer, event),
      };

      return occurrencesBetween(entry, from, to).map((date) => ({
        entry: { ...entry, date },
        createdAt: event.createdAt.getTime(),
      }));
    })
    .sort(
      (a, b) =>
        a.entry.date.localeCompare(b.entry.date) ||
        (a.entry.startTime ?? "").localeCompare(b.entry.startTime ?? "") ||
        a.createdAt - b.createdAt
    )
    .map(({ entry }) => entry);
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
