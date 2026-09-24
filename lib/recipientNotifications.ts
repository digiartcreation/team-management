import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export async function notifyAdminsAndTeamManagers({
  actorUserId,
  title,
  message,
  type,
}: {
  actorUserId: string;
  title: string;
  message: string;
  type:
    | "DAILY_UPDATE_CREATED"
    | "TASK_UPDATED"
    | "FEEDBACK_SUBMITTED"
    | "ATTENDANCE_UPDATED"
    | "LEARNING_UPDATED"
    | "TOOL_USAGE_UPDATED";
}) {
  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { teamId: true },
  });
  const recipients = await prisma.user.findMany({
    where: {
      OR: [
        { role: "admin" },
        { role: "manager", teamId: actor?.teamId ?? "__no_team__" },
      ],
    },
    select: { id: true },
  });

  await Promise.all(
    recipients
      .filter((recipient) => recipient.id !== actorUserId)
      .map((recipient) =>
        createNotification({
          userId: recipient.id,
          title,
          message,
          type,
        })
      )
  );
}
