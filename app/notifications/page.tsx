import { redirect } from "next/navigation";
import { getShellSession, preloadShell } from "@/lib/shell";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { markAllNotificationsRead, markNotificationRead } from "@/app/notifications/actions";
import { getVisibleNotificationWhere } from "@/lib/notifications";
import ActionMenu from "@/components/ui/ActionMenu";
import PushNotificationToggle from "@/components/notifications/PushNotificationToggle";
import PaginationControls from "@/components/layout/PaginationControls";
import { getPage, getPagination, PAGE_SIZE } from "@/lib/pagination";

type NotificationsPageProps = {
  searchParams: Promise<{ page?: string }>;
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const session = await getShellSession();
  if (!session?.user) redirect("/login");
  preloadShell(session);
  const sessionUser = session.user as typeof session.user & { id?: string; role?: string };
  if (!sessionUser.id) redirect("/login");
  if (sessionUser.role === "admin") redirect("/");
  const filters = await searchParams;
  const page = getPage(filters.page);
  const where = getVisibleNotificationWhere(sessionUser.id);
  // One page at a time: notifications are never deleted, so the full list
  // only grows.
  const [notifications, totalNotifications] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
      ...getPagination(page),
    }),
    prisma.notification.count({ where }),
  ]);

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase text-slate-500">Notifications</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Notifications</h1>
          </div>
          <form action={markAllNotificationsRead}>
            <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
              Mark all as read
            </button>
          </form>
        </header>
        <PushNotificationToggle />
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-slate-700">No notifications found.</p>
              <p className="mt-1 text-sm text-slate-500">Notifications will appear here when there is activity.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between ${
                    notification.isRead ? "bg-white" : "bg-slate-50"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-950">{notification.title}</div>
                    <div className="mt-1 whitespace-pre-line break-words text-sm text-slate-600">
                      {notification.message}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {notification.type} · {notification.user.name} · {dateFormatter.format(notification.createdAt)}
                    </div>
                  </div>
                  {notification.isRead ? (
                    <span className="shrink-0 text-sm text-slate-400">Read</span>
                  ) : (
                    <ActionMenu>
                      <form
                        action={async () => {
                          "use server";
                          await markNotificationRead(notification.id);
                        }}
                      >
                        <button className="rounded px-3 py-2 text-left text-sm text-[#1F2937] transition hover:bg-[#F3E8FF] hover:text-[#770FC2]">
                          Mark as read
                        </button>
                      </form>
                    </ActionMenu>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
        <PaginationControls
          page={page}
          total={totalNotifications}
          pageSize={PAGE_SIZE}
          basePath="/notifications"
          searchParams={filters}
        />
      </div>
    </DashboardLayout>
  );
}
