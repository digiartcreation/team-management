import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { sendPushToUser } from "@/lib/pushNotifications";

type NotificationType =
  | "TASK_ASSIGNED"
  | "TASK_UPDATED"
  | "TASK_COMPLETED"
  | "DAILY_UPDATE_CREATED"
  | "ANNOUNCEMENT"
  | "FEEDBACK_SUBMITTED"
  | "FEEDBACK_UPDATED"
  | "ATTENDANCE_UPDATED"
  | "LEARNING_UPDATED"
  | "TOOL_USAGE_UPDATED"
  | "CALENDAR_SHARED";

type NotificationInput = {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
};

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

export async function createNotification({
  userId,
  title,
  message,
  type,
}: NotificationInput) {
  await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type,
    },
  });

  await sendPushToUser(userId, {
    title,
    body: message,
    url: "/notifications",
  });
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

  await Promise.all(
    users.map((user) =>
      sendPushToUser(user.id, {
        title,
        body: message,
        url: "/",
      })
    )
  );
}
