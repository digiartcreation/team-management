import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import {
  minutesFromTime,
  officeInstant,
  officeMinutes,
} from "@/lib/officeTime";

/** Check-out is open until 10 PM on the office clock; check-in closes with it. */
export const CHECK_OUT_CUTOFF = "22:00";

/** Whether the office day `now` falls on is past its check-out cut-off. */
export function isCheckOutClosed(now: Date) {
  return officeMinutes(now) >= minutesFromTime(CHECK_OUT_CUTOFF);
}

/** A session nobody checked out of counts for this long. */
export const AUTO_CHECK_OUT_MINUTES = 30;

/**
 * Where a session left open will be closed: 30 minutes after its check-in
 * (7:30 PM -> 8:00 PM), but no later than its day's cut-off.
 */
export function autoCheckOutAt(day: Date, checkInTime: Date) {
  const cutoff = officeInstant(day, minutesFromTime(CHECK_OUT_CUTOFF));
  const closesAt = new Date(
    checkInTime.getTime() + AUTO_CHECK_OUT_MINUTES * 60_000
  );
  // A check-in from before the cut-off existed can sit past it; it still
  // gets its 30 minutes rather than closing before it began.
  return checkInTime < cutoff && closesAt > cutoff ? cutoff : closesAt;
}

/**
 * The check-out to record for a session nobody checked out of. Null while
 * its day's cut-off has not passed, since it can still be checked out by hand.
 */
export function autoCheckOutTime(day: Date, checkInTime: Date, now: Date) {
  if (now < officeInstant(day, minutesFromTime(CHECK_OUT_CUTOFF))) {
    return null;
  }

  return autoCheckOutAt(day, checkInTime);
}

/**
 * Checks out every session still open past its day's cut-off. There is no
 * background job, so the attendance page and the check-in / check-out actions
 * run this first; any day they show or change is already settled.
 */
export async function closeExpiredSessions(now: Date) {
  const open = await prisma.attendanceSession.findMany({
    where: { checkOutTime: null },
    select: {
      id: true,
      checkInTime: true,
      attendance: {
        select: { id: true, userId: true, date: true, scheduledEndTime: true },
      },
    },
  });

  for (const session of open) {
    const { attendance } = session;
    const checkOutTime = autoCheckOutTime(
      attendance.date,
      session.checkInTime,
      now
    );

    if (!checkOutTime) {
      continue;
    }

    // Counted from the day's own midnight, so a check-out past midnight is
    // never mistaken for an early one.
    const checkOutMinutes = Math.round(
      (checkOutTime.getTime() - officeInstant(attendance.date, 0).getTime()) /
        60_000
    );
    const earlyDepartureMinutes = Math.max(
      0,
      minutesFromTime(attendance.scheduledEndTime) - checkOutMinutes
    );

    const closed = await prisma.$transaction(async (tx) => {
      // Another request may have closed it since the read above.
      const { count } = await tx.attendanceSession.updateMany({
        where: { id: session.id, checkOutTime: null },
        data: { checkOutTime },
      });

      if (count === 0) {
        return false;
      }

      // The open session is always the day's latest, so it sets the day's
      // check-out and early departure, as a check-out by hand would.
      await tx.attendanceRecord.update({
        where: { id: attendance.id },
        data: {
          actualCheckOutTime: checkOutTime,
          earlyDepartureMinutes: earlyDepartureMinutes || null,
        },
      });

      return true;
    });

    if (closed) {
      await logActivity({
        userId: attendance.userId,
        action: "updated",
        entityType: "attendance",
        entityId: attendance.id,
        description: `Checked out automatically (no check-out by ${CHECK_OUT_CUTOFF})`,
      });
    }
  }
}
