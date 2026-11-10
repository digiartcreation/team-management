import { ReactNode } from "react";
import LogoutButton from "@/components/layout/LogoutButton";
import Sidebar from "@/components/layout/Sidebar";
import AnnouncementBanner from "@/components/layout/AnnouncementBanner";
import type { ModuleKey } from "@/lib/moduleAlerts";
import { getShellData, getShellSession } from "@/lib/shell";

type DashboardLayoutProps = {
  children: ReactNode;
  /** The module this page lists, marked as reviewed: see getSidebarAlertCounts. */
  reviewModule?: ModuleKey;
};

export default async function DashboardLayout({ children, reviewModule }: DashboardLayoutProps) {
  const session = await getShellSession();
  const sessionUser = session?.user as
    | (NonNullable<typeof session>["user"] & {
        id?: string;
        role?: string;
        isSuperAdmin?: boolean;
      })
    | undefined;
  const userId = sessionUser?.id;

  // Everything the menu and the banner show (lib/shell.ts). Pages start it as
  // soon as they have the session (preloadShell), so by now it is usually done.
  const { account, unreadNotifications, visibleNotifications, moduleAlertCounts, calendarCounts } =
    await getShellData(userId, sessionUser?.role, reviewModule);

  // Made inactive (or deleted) while signed in: the session lives on, but
  // the app does not open for it.
  if (userId) {
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
