import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getVisibleNotificationWhere } from "@/lib/notifications";
import { getSidebarAlertCounts, type ModuleKey } from "@/lib/moduleAlerts";
import { countTodayAndTomorrow } from "@/lib/calendarEvents";
import { getViewerAccount } from "@/lib/viewer";

/**
 * The signed-in session, read once per request: the page and the shell
 * (components/layout/DashboardLayout.tsx) both need it, and each auth() call
 * decodes the session cookie again.
 */
export const getShellSession = cache(() => auth());

type ShellUser = { id?: string; role?: string } | undefined;

/**
 * Everything the menu and the banner show: the viewer's account (for the
 * inactive check), unread announcements, the menu badges and the calendar
 * counts. Read once per request (React cache), so a page can start it the
 * moment it knows who is signed in -- preloadShell() -- and its queries run
 * alongside the page's own, instead of after them when the shell renders.
 */
export const getShellData = cache(
  async (userId: string | undefined, role: string | undefined, reviewModule?: ModuleKey) => {
    const [account, unreadNotifications, visibleNotifications, moduleAlertCounts, calendarCounts] =
      await Promise.all([
        userId ? getViewerAccount(userId) : null,
        userId && role !== "admin"
          ? prisma.notification.count({
              where: getVisibleNotificationWhere(userId, {
                isRead: false,
              }),
            })
          : 0,
        userId
          ? prisma.notification.findMany({
              where: getVisibleNotificationWhere(userId, {
                isRead: false,
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
              }),
              orderBy: { createdAt: "desc" },
              take: 8,
            })
          : [],
        getSidebarAlertCounts(userId, role, reviewModule),
        userId ? countTodayAndTomorrow({ id: userId, role }) : undefined,
      ]);

    return { account, unreadNotifications, visibleNotifications, moduleAlertCounts, calendarCounts };
  }
);

/**
 * Starts the shell's queries without waiting for them. Call it as soon as the
 * page has the session; DashboardLayout then picks up the same request-cached
 * result. `reviewModule` must match the one the page gives DashboardLayout.
 */
export function preloadShell(session: { user?: unknown } | null, reviewModule?: ModuleKey) {
  const user = session?.user as ShellUser;

  if (user?.id) {
    void getShellData(user.id, user.role, reviewModule);
  }
}
