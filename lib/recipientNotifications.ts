import { prisma } from "@/lib/prisma";
import { getUserTeamIds, usersOnTeams } from "@/lib/teams";
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
  // Managers on any team the actor is on.
  const actorTeamIds = await getUserTeamIds(actorUserId);
  const recipients = await prisma.user.findMany({
    where: {
      OR: [
        { role: "admin" },
        { role: "manager", ...usersOnTeams(actorTeamIds) },
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
