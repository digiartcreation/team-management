import { prisma } from "@/lib/prisma";
import {
  calendarGridDays,
  canManageCalendarEvent,
  type CalendarEntry,
} from "@/lib/calendar";

/**
 * The entries on a month's grid that `viewer` may see: their own, private or
 * not, and everything shared with everyone. Ordered by day, all-day entries
 * first (MySQL sorts a null start time ahead of the rest), then by start time.
 */
export async function loadCalendarMonth(
  viewer: { id: string; role?: string },
  month: string
): Promise<CalendarEntry[]> {
  const days = calendarGridDays(month);
  const events = await prisma.calendarEvent.findMany({
    where: {
      date: {
        gte: new Date(`${days[0]}T00:00:00.000Z`),
        lte: new Date(`${days[days.length - 1]}T00:00:00.000Z`),
      },
      OR: [{ createdById: viewer.id }, { visibility: "everyone" }],
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
    createdByName: event.createdBy.name,
    isOwn: event.createdById === viewer.id,
    canManage: canManageCalendarEvent(viewer, event),
  }));
}
