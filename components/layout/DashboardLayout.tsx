import { ReactNode } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import LogoutButton from "@/components/layout/LogoutButton";
import Sidebar from "@/components/layout/Sidebar";
import AnnouncementBanner from "@/components/layout/AnnouncementBanner";
import { getVisibleNotificationWhere } from "@/lib/notifications";
import { getSidebarAlertCounts } from "@/lib/moduleAlerts";
import { countTodayAndTomorrow } from "@/lib/calendarEvents";

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

  // Made inactive (or deleted) while signed in: the session lives on, but
  // the app does not open for it.
  if (sessionUser?.id) {
    const account = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { isActive: true },
    });

    if (!account?.isActive) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-[#F8F7FB] px-4">
          <div className="w-full max-w-md rounded-lg border border-[#E5E7EB] bg-white p-6 text-center shadow-sm">
            <h1 className="text-lg font-semibold text-[#1F2937]">
              Your account is inactive
            </h1>
            <p className="mt-2 text-sm text-[#6B7280]">
              Ask an admin to make it active again, then sign in.
            </p>
            <div className="mt-5 flex justify-center">
              <LogoutButton />
            </div>
          </div>
        </main>
      );
    }
  }

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
  const calendarCounts = sessionUser?.id
    ? await countTodayAndTomorrow({ id: sessionUser.id, role: sessionUser.role })
    : undefined;
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
        calendarCounts={calendarCounts}
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
