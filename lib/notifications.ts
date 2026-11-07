import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { sendPushAfterResponse } from "@/lib/pushNotifications";

// Only announcements and admin broadcasts (both "ANNOUNCEMENT") are shown --
// in the banner, the unread count and the Notifications page. Activities
// (tasks, updates, learnings, tools, feedback, attendance, calendar) no longer
// create notifications, and the ones they created before stay hidden; the
// rows are kept, not deleted.
const visibleNotificationTypes = ["ANNOUNCEMENT"];

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
