import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { sendPushAfterResponse } from "@/lib/pushNotifications";

// Activities (tasks, updates, learnings, tools, feedback, attendance,
// calendar) no longer create notifications; only announcements and admin
// broadcasts do. The older types stay listed so earlier notifications still
// show on the Notifications page.
const visibleNotificationTypes = [
  "ANNOUNCEMENT",
  "TASK_ASSIGNED",
  "TASK_UPDATED",
  "TASK_COMPLETED",
  "DAILY_UPDATE_CREATED",
  "FEEDBACK_SUBMITTED",
  "FEEDBACK_UPDATED",
  "ATTENDANCE_UPDATED",
  "LEARNING_UPDATED",
  "TOOL_USAGE_UPDATED",
  "CALENDAR_SHARED",
  "CALENDAR_RESPONSE",
];

export function getVisibleNotificationWhere(
  userId: string,
  extraWhere: Prisma.NotificationWhereInput = {}
): Prisma.NotificationWhereInput {
  return {
    userId,
    type: {
      in: visibleNotificationTypes,
    },
    ...extraWhere,
  };
}

export async function createAnnouncementNotifications(
  title: string,
  message: string
) {
  const users = await prisma.user.findMany({
    select: {
      id: true,
    },
  });

  if (users.length === 0) {
    return;
  }

  await prisma.notification.createMany({
    data: users.map((user) => ({
      userId: user.id,
      title,
      message,
      type: "ANNOUNCEMENT",
    })),
  });

  for (const user of users) {
    sendPushAfterResponse(user.id, {
      title,
      body: message,
      url: "/",
    });
  }
}
