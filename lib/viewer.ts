import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * The signed-in person's own account fields, read once per request: a page
 * (a manager's team scope), DashboardLayout (the inactive check) and the menu
 * badges all ask for them while rendering the same page.
 */
export const getViewerAccount = cache(async (userId: string | undefined) =>
  userId
    ? prisma.user.findUnique({
        where: { id: userId },
        select: { isActive: true, teamId: true },
      })
    : null
);
