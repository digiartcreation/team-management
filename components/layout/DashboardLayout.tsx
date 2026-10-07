import { ReactNode } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/layout/Sidebar";
import AnnouncementBanner from "@/components/layout/AnnouncementBanner";
import { getVisibleNotificationWhere } from "@/lib/notifications";
import { getSidebarAlertCounts } from "@/lib/moduleAlerts";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const session = await auth();
  const sessionUser = session?.user as
    | (NonNullable<typeof session>["user"] & {
        id?: string;
        role?: string;
        isSuperAdmin?: boolean;
      })
    | undefined;
  const unreadNotifications = sessionUser?.id
    ? sessionUser.role === "admin"
      ? 0
      : await prisma.notification.count({
        where: getVisibleNotificationWhere(sessionUser.id, {
          isRead: false,
        }),
      })
    : 0;
  const visibleNotifications = sessionUser?.id
    ? await prisma.notification.findMany({
        where: getVisibleNotificationWhere(sessionUser.id, {
          isRead: false,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        }),
        orderBy: { createdAt: "desc" },
        take: 8,
      })
    : [];
  const moduleAlertCounts = await getSidebarAlertCounts(
    sessionUser?.id,
    sessionUser?.role
  );
  const sidebarAlertCounts = {
    "/tasks": moduleAlertCounts.tasks,
    "/updates": moduleAlertCounts.updates,
    "/learnings": moduleAlertCounts.learnings,
    "/tools": moduleAlertCounts.tools,
  };

  return (
    <div className="min-h-screen bg-[#F8F7FB] text-[#1F2937] lg:flex">
      <Sidebar
        role={sessionUser?.role}
        isSuperAdmin={sessionUser?.isSuperAdmin === true}
        unreadNotifications={unreadNotifications}
        alertCounts={sidebarAlertCounts}
      />
      <main className="flex-1">
        <AnnouncementBanner
          announcements={visibleNotifications}
          userId={sessionUser?.id}
        />
        {children}
      </main>
    </div>
  );
}
