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

/**
 * When a session nobody checked out of is taken to have ended: the end of the
 * shift (6 PM), or its check-in if that came later. Null while its day's
 * cut-off has not passed, since it can still be checked out by hand.
 */
export function autoCheckOutTime(
  day: Date,
  scheduledEndTime: string,
  checkInTime: Date,
  now: Date
) {
  if (now < officeInstant(day, minutesFromTime(CHECK_OUT_CUTOFF))) {
    return null;
  }

  const shiftEnd = officeInstant(day, minutesFromTime(scheduledEndTime));
  return shiftEnd > checkInTime ? shiftEnd : checkInTime;
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
      attendance.scheduledEndTime,
      session.checkInTime,
      now
    );

    if (!checkOutTime) {
      continue;
    }

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
      // check-out. It is never before the shift end, so never an early one.
      await tx.attendanceRecord.update({
        where: { id: attendance.id },
        data: { actualCheckOutTime: checkOutTime, earlyDepartureMinutes: null },
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
