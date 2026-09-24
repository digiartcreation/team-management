import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PaginationControls from "@/components/layout/PaginationControls";
import { getPage, getPagination, PAGE_SIZE } from "@/lib/pagination";

type ActivityPageProps = {
  searchParams: Promise<{ entityType?: string; page?: string }>;
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sessionUser = session.user as typeof session.user & {
    id?: string;
    role?: string;
  };
  if (!sessionUser.id) redirect("/login");

  const currentUser =
    sessionUser.role === "manager"
      ? await prisma.user.findUnique({
          where: { id: sessionUser.id },
          select: { teamId: true },
        })
      : null;

  const managerTeamId = currentUser?.teamId ?? "__no_team__";
  const showUserColumn = sessionUser.role !== "member";

  const { entityType } = await searchParams;
  const page = getPage((await searchParams).page);

  const baseWhere: Prisma.ActivityLogWhereInput =
    sessionUser.role === "admin"
      ? {}
      : sessionUser.role === "manager"
        ? { user: { teamId: managerTeamId } }
        : { userId: sessionUser.id };

  const where: Prisma.ActivityLogWhereInput = {
    ...baseWhere,
    ...(entityType?.trim() ? { entityType: entityType.trim() } : {}),
  };

  const [logs, totalLogs, entityTypes] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      ...getPagination(page),
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where: baseWhere,
      select: { entityType: true },
      distinct: ["entityType"],
      orderBy: { entityType: "asc" },
    }),
  ]);

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header>
          <p className="text-sm font-medium uppercase text-slate-500">Activity</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Activity Logs</h1>
        </header>

        <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[220px_auto_auto]">
          <select
            name="entityType"
            defaultValue={entityType ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All entity types</option>
            {entityTypes.map((item: { entityType: string }) => (
              <option key={item.entityType} value={item.entityType}>
                {item.entityType}
              </option>
            ))}
          </select>
          <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
            Filter
          </button>
          <a
            href="/activity"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Reset
          </a>
        </form>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {logs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-slate-700">No activity logs found.</p>
              <p className="mt-1 text-sm text-slate-500">Tracked actions will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    {showUserColumn ? <th className="px-4 py-3">User</th> : null}
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-4 py-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4 text-slate-600">
                        {dateFormatter.format(log.createdAt)}
                      </td>
                      {showUserColumn ? (
                        <td className="px-4 py-4 font-medium text-slate-950">
                          {log.user.name}
                        </td>
                      ) : null}
                      <td className="px-4 py-4 text-slate-600">{log.action}</td>
                      <td className="px-4 py-4 text-slate-600">{log.entityType}</td>
                      <td className="px-4 py-4 whitespace-pre-line break-words text-slate-600">
                        {log.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <PaginationControls
          page={page}
          total={totalLogs}
          pageSize={PAGE_SIZE}
          basePath="/activity"
          searchParams={await searchParams}
        />
      </div>
    </DashboardLayout>
  );
}
