"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { createNotification } from "@/lib/notifications";

const scheduledStartTime = "09:00";
const scheduledEndTime = "18:00";

function startOfToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesFromDate(value: Date) {
  return value.getHours() * 60 + value.getMinutes();
}

async function getSessionUser() {
  const session = await auth();
  const sessionUser = session?.user as
    | (NonNullable<typeof session>["user"] & { id?: string; role?: string })
    | undefined;

  if (!sessionUser?.id) redirect("/login");
  return sessionUser as typeof sessionUser & { id: string };
}

async function notifyAdmins(message: string) {
  const admins = await prisma.user.findMany({
    where: { role: "admin" },
    select: { id: true },
  });

  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        title: "Attendance update",
        message,
        type: "ATTENDANCE_UPDATED",
      })
    )
  );
}

/** Today's day row with its sessions, oldest first. */
async function findToday(userId: string, date: Date) {
  return prisma.attendanceRecord.findUnique({
    where: { userId_date: { userId, date } },
    select: {
      id: true,
      actualCheckInTime: true,
      sessions: {
        orderBy: { checkInTime: "asc" },
        select: { id: true, checkOutTime: true },
      },
    },
  });
}

/**
 * Starts a work session. The first one of the day creates the day's row and
 * sets the status and lateness from it; every later one -- back from lunch, back
 * from a client visit -- only opens another session, since lateness is about
 * when the day began.
 */
export async function checkIn() {
  const sessionUser = await getSessionUser();
  const now = new Date();
  const date = startOfToday();
  const existing = await findToday(sessionUser.id, date);

  if (existing?.sessions.some((session) => !session.checkOutTime)) {
    throw new Error("You are already checked in. Check out first.");
  }

  let attendanceId: string;
  const firstOfDay = !existing;

  if (existing) {
    attendanceId = existing.id;
    await prisma.$transaction([
      prisma.attendanceSession.create({
        data: { attendanceId, checkInTime: now },
      }),
      // Checked in again, so the day has no final check-out yet.
      prisma.attendanceRecord.update({
        where: { id: attendanceId },
        data: { actualCheckOutTime: null, earlyDepartureMinutes: null },
      }),
    ]);
  } else {
    const lateDurationMinutes = Math.max(
      0,
      minutesFromDate(now) - minutesFromTime(scheduledStartTime)
    );

    try {
      const attendance = await prisma.attendanceRecord.create({
        data: {
          userId: sessionUser.id,
          date,
          scheduledStartTime,
          scheduledEndTime,
          actualCheckInTime: now,
          status: lateDurationMinutes > 0 ? "Late" : "Present",
          lateDurationMinutes: lateDurationMinutes || null,
          sessions: { create: { checkInTime: now } },
        },
        select: { id: true },
      });
      attendanceId = attendance.id;
    } catch (error) {
      // Two check-ins raced to create the day; the other one won.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new Error("Attendance was just recorded. Refresh the page.");
      }

      throw error;
    }
  }

  await logActivity({
    userId: sessionUser.id,
    action: firstOfDay ? "created" : "updated",
    entityType: "attendance",
    entityId: attendanceId,
    description: firstOfDay
      ? "Recorded attendance check-in"
      : "Checked in again",
  });

  // Admins hear about the start of the day, not about every break.
  if (firstOfDay) {
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { name: true },
    });
    await notifyAdmins(
      `New attendance check-in recorded for ${user?.name ?? "a team member"}.`
    );
  }

  revalidatePath("/attendance");
}

/**
 * Closes the open session. The day's check-out and early-departure minutes
 * always follow the latest one, so they settle on the last check-out of the day.
 */
export async function checkOut() {
  const sessionUser = await getSessionUser();
  const now = new Date();
  const date = startOfToday();
  const existing = await findToday(sessionUser.id, date);

  if (!existing) {
    throw new Error("Check in before recording check-out.");
  }

  const open = existing.sessions.find((session) => !session.checkOutTime);

  if (!open) {
    throw new Error("You are not checked in right now.");
  }

  const earlyDepartureMinutes = Math.max(
    0,
    minutesFromTime(scheduledEndTime) - minutesFromDate(now)
  );

  await prisma.$transaction([
    prisma.attendanceSession.update({
      where: { id: open.id },
      data: { checkOutTime: now },
    }),
    prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: {
        actualCheckOutTime: now,
        earlyDepartureMinutes: earlyDepartureMinutes || null,
      },
    }),
  ]);

  await logActivity({
    userId: sessionUser.id,
    action: "updated",
    entityType: "attendance",
    entityId: existing.id,
    description: "Recorded attendance check-out",
  });

  revalidatePath("/attendance");
}
