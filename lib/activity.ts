import { prisma } from "@/lib/prisma";
import { fitText } from "@/lib/fitText";

type ActivityInput = {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
};

export async function logActivity({
  userId,
  action,
  entityType,
  entityId,
  description,
}: ActivityInput) {
  await prisma.activityLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      // Quotes titles that can run to any length; the column holds 191.
      description: fitText(description),
    },
  });
}
