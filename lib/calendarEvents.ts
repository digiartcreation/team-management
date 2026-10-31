import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  calendarGridDays,
  canManageCalendarEvent,
  occurrencesBetween,
  officeToday,
  parseRepeatDays,
  type CalendarEntry,
} from "@/lib/calendar";
import { minutesFromTime, officeMinutes } from "@/lib/officeTime";
import { getWatcherOptions } from "@/lib/taskWatchers";

type Viewer = { id: string; role?: string };

/**
 * Entries `viewer` may see that can fall between `from` and `to`: their own,
 * those shared with them or with everyone, set for a day in the range or set
 * earlier and still repeating into it.
 */
function visibleBetween(viewer: Viewer, from: string, to: string): Prisma.CalendarEventWhereInput {
  return {
    AND: [
      {
        OR: [
          { createdById: viewer.id },
          { visibility: "everyone" },
          { visibility: "selected", shares: { some: { userId: viewer.id } } },
        ],
      },
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
  };
}

/**
 * How many entries `viewer` still has today and has tomorrow on the office
 * clock, repeats included: the two counts beside Calendar in the menu. One of
 * today's that has already ended -- past its end time, or its start time when
 * it has no end -- no longer counts; an all-day one counts all day. Entries the
 * viewer declined never count.
 */
export async function countTodayAndTomorrow(viewer: Viewer) {
  const now = new Date();
  const today = officeToday();
  const nowMinutes = officeMinutes(now);
  const tomorrow = new Date(Date.parse(`${today}T00:00:00.000Z`) + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const events = await prisma.calendarEvent.findMany({
    where: visibleBetween(viewer, today, tomorrow),
    select: {
      date: true,
      startTime: true,
      endTime: true,
      recurrence: true,
      repeatDays: true,
      repeatMonthDay: true,
      repeatUntil: true,
      shares: { where: { userId: viewer.id }, select: { response: true } },
    },
  });
  const counts = { today: 0, tomorrow: 0 };

  for (const event of events) {
    if (event.shares[0]?.response === "declined") {
      continue;
    }

    const lastTime = event.endTime ?? event.startTime;
    const endedToday = lastTime !== null && minutesFromTime(lastTime) <= nowMinutes;
    const days = occurrencesBetween(
      {
        seriesDate: event.date.toISOString().slice(0, 10),
        recurrence: event.recurrence,
        repeatDays: parseRepeatDays(event.repeatDays),
        repeatMonthDay: event.repeatMonthDay,
        repeatUntil: event.repeatUntil?.toISOString().slice(0, 10) ?? null,
      },
      today,
      tomorrow
    );

    counts.today += days.includes(today) && !endedToday ? 1 : 0;
    counts.tomorrow += days.includes(tomorrow) ? 1 : 0;
  }

  return counts;
}

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
    where: visibleBetween(viewer, from, to),
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
        select: {
          response: true,
          responseReason: true,
          respondedAt: true,
          user: { select: { id: true, name: true } },
        },
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
        sharedWith: event.shares.map((share) => ({
          ...share.user,
          response: share.response,
          reason: share.responseReason,
          respondedAt: share.respondedAt?.toISOString() ?? null,
        })),
        myResponse: event.shares.find((share) => share.user.id === viewer.id)?.response ?? null,
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
