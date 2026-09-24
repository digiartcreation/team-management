import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PaginationControls from "@/components/layout/PaginationControls";
import { getPage, getPagination, PAGE_SIZE } from "@/lib/pagination";
import ModuleReviewMarker from "@/components/layout/ModuleReviewMarker";
import ActionMenu from "@/components/ui/ActionMenu";
import DeleteMenuAction from "@/components/ui/DeleteMenuAction";
import { deleteDailyUpdate } from "@/app/updates/actions";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  day: "numeric",
  month: "short",
});

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

type UpdatesPageProps = {
  searchParams: Promise<{
    page?: string;
    employeeId?: string;
    date?: string;
    from?: string;
    to?: string;
  }>;
};

export default async function UpdatesPage({ searchParams }: UpdatesPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const sessionUser = session.user as typeof session.user & {
    id?: string;
    role?: string;
  };

  const currentUser =
    sessionUser.role === "manager"
      ? await prisma.user.findUnique({
          where: { id: sessionUser.id },
          select: { teamId: true },
        })
      : null;

  const params = await searchParams;
  const page = getPage(params.page);
  const employeeId = params.employeeId?.trim() || undefined;
  const date = params.date?.trim() || undefined;
  const from = params.from?.trim() || undefined;
  const to = params.to?.trim() || undefined;

  const showEmployeeColumn = sessionUser.role === "admin";
  const isManager = sessionUser.role === "manager";
  const managerTeamId = currentUser?.teamId ?? "__no_team__";

  let dateWhere: Prisma.DateTimeFilter | undefined;
  if (date && datePattern.test(date)) {
    dateWhere = {
      gte: new Date(`${date}T00:00:00.000Z`),
      lte: new Date(`${date}T23:59:59.999Z`),
    };
  } else if ((from && datePattern.test(from)) || (to && datePattern.test(to))) {
    dateWhere = {
      ...(from && datePattern.test(from)
        ? { gte: new Date(`${from}T00:00:00.000Z`) }
        : {}),
      ...(to && datePattern.test(to)
        ? { lte: new Date(`${to}T23:59:59.999Z`) }
        : {}),
    };
  }

  const where: Prisma.DailyUpdateWhereInput =
    sessionUser.role === "admin"
      ? {
          ...(employeeId ? { userId: employeeId } : {}),
          ...(dateWhere ? { date: dateWhere } : {}),
        }
      : isManager
        ? {
            user: { teamId: managerTeamId },
            ...(employeeId ? { userId: employeeId } : {}),
            ...(dateWhere ? { date: dateWhere } : {}),
          }
        : {
            userId: sessionUser.id,
            ...(dateWhere ? { date: dateWhere } : {}),
          };

  const [updates, totalUpdates, employees] = await Promise.all([
    prisma.dailyUpdate.findMany({
      where,
      ...getPagination(page),
      orderBy: { date: "desc" },
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
      },
    }),
    prisma.dailyUpdate.count({ where }),
    sessionUser.role === "admin"
      ? prisma.user.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : isManager
        ? prisma.user.findMany({
            where: { teamId: managerTeamId },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
  ]);

  const showEmployeeFilter =
    sessionUser.role === "admin" || sessionUser.role === "manager";

  return (
    <DashboardLayout>
      <ModuleReviewMarker module="updates" />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-normal text-slate-500">
              Daily Updates
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
              Status Updates
            </h1>
          </div>
          {sessionUser.role !== "admin" ? (
            <Link
              href="/updates/new"
              className="inline-flex items-center justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Add Update
            </Link>
          ) : null}
        </header>

        <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
          {showEmployeeFilter ? (
            <label className="grid gap-1">
              <span className="text-xs font-medium text-slate-700">Employee</span>
              <select
                name="employeeId"
                defaultValue={employeeId ?? ""}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">All employees</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-700">Date</span>
            <input
              name="date"
              type="date"
              defaultValue={date ?? ""}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-700">From Date</span>
            <input
              name="from"
              type="date"
              defaultValue={from ?? ""}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-700">To Date</span>
            <input
              name="to"
              type="date"
              defaultValue={to ?? ""}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
            <button
              type="submit"
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Filter
            </button>
            <Link
              href="/updates"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Clear Filters
            </Link>
          </div>
        </form>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {updates.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-slate-700">
                No daily updates found.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Updates will appear here after they are submitted.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-normal text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Created On</th>
                    {showEmployeeColumn ? (
                      <th className="px-4 py-3 font-semibold">Employee</th>
                    ) : null}
                    <th className="px-4 py-3 font-semibold">Today&apos;s Tasks</th>
                    <th className="px-4 py-3 font-semibold">Blockers</th>
                    <th className="px-4 py-3 font-semibold">
                      <span className="sr-only">Row menu</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {updates.map((update) => (
                    <tr key={update.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4 text-slate-600">
                        <div>{dateFormatter.format(update.createdAt)}</div>
                        {update.updatedAt.getTime() !== update.createdAt.getTime() ? (
                          <div className="mt-1 text-xs text-slate-500">
                            Edited on {dateFormatter.format(update.updatedAt)}
                          </div>
                        ) : null}
                      </td>
                      {showEmployeeColumn ? (
                        <td className="px-4 py-4 font-medium text-slate-950">
                          {update.user.name}
                        </td>
                      ) : null}
                      <td className="px-4 py-4 text-slate-600">
                        <div className="whitespace-pre-line break-words">{update.todaysTasks}</div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        <div className="whitespace-pre-line break-words">{update.blockers || "None"}</div>
                      </td>
                      <td className="px-4 py-4">
                        {update.user.id === sessionUser.id ? (
                          <ActionMenu>
                            <Link
                              href={`/updates/${update.id}/edit`}
                              className="rounded px-3 py-2 text-sm text-[#1F2937] transition hover:bg-[#F3E8FF] hover:text-[#770FC2]"
                            >
                              Edit
                            </Link>
                            <DeleteMenuAction
                              id={update.id}
                              action={deleteDailyUpdate}
                              message="Are you sure you want to delete this daily update?"
                            />
                          </ActionMenu>
                        ) : (
                          <span className="text-sm text-slate-400">
                            View only
                          </span>
                        )}
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
          total={totalUpdates}
          pageSize={PAGE_SIZE}
          basePath="/updates"
          searchParams={params}
        />
      </div>
    </DashboardLayout>
  );
}
