import Link from "next/link";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DeleteTaskButton from "@/components/tasks/DeleteTaskButton";
import { updateOwnTaskStatus } from "@/app/tasks/actions";
import PaginationControls from "@/components/layout/PaginationControls";
import { getPage, getPagination, PAGE_SIZE } from "@/lib/pagination";
import ModuleReviewMarker from "@/components/layout/ModuleReviewMarker";
import ActionMenu from "@/components/ui/ActionMenu";

const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const statusOptions = ["pending", "in_progress", "completed"];
const priorityOptions = ["low", "medium", "high"];

type TasksPageProps = {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    teamId?: string;
    assignedToId?: string;
    clientId?: string;
    page?: string;
  }>;
};

function formatLabel(value: string) {
  return value
    .replace("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const sessionUser = session.user as typeof session.user & {
    id?: string;
    role?: string;
  };
  const canManageTasks =
    sessionUser.role === "admin" || sessionUser.role === "manager";
  const canDeleteTasks = sessionUser.role === "admin";
  const isMember = sessionUser.role === "member";

  const filters = await searchParams;
  const page = getPage(filters.page);
  const where: Prisma.TaskWhereInput = {};

  const currentUser =
    sessionUser.role === "manager"
      ? await prisma.user.findUnique({
          where: { id: sessionUser.id },
          select: { teamId: true },
        })
      : null;
  const managerTeamId =
    sessionUser.role === "manager" ? currentUser?.teamId ?? "__no_team__" : undefined;

  if (isMember) {
    where.assignedToId = sessionUser.id;
  } else if (sessionUser.role === "manager") {
    where.teamId = managerTeamId;
  }

  if (filters.status && statusOptions.includes(filters.status)) {
    where.status = filters.status;
  }

  if (filters.priority && priorityOptions.includes(filters.priority)) {
    where.priority = filters.priority;
  }

  if (sessionUser.role !== "manager" && filters.teamId) {
    where.teamId = filters.teamId;
  }

  if (!isMember && filters.assignedToId) {
    where.assignedToId = filters.assignedToId;
  }

  if (filters.clientId) {
    where.clientId = filters.clientId;
  }

  const [tasks, totalTasks, employees, teams, clientOptions] = await Promise.all([
    prisma.task.findMany({
      where,
      ...getPagination(page),
      orderBy: {
        createdAt: "desc",
      },
      include: {
        assignedTo: {
          select: {
            name: true,
          },
        },
        team: {
          select: {
            name: true,
          },
        },
        client: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.task.count({ where }),
    prisma.user.findMany({
      where: isMember
        ? { id: sessionUser.id }
        : managerTeamId
          ? { teamId: managerTeamId }
          : undefined,
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.team.findMany({
      where: managerTeamId ? { id: managerTeamId } : undefined,
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
    // Every client, not just active ones, so older mappings stay filterable.
    prisma.client.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  return (
    <DashboardLayout>
      <ModuleReviewMarker module="tasks" />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-normal text-slate-500">
              Tasks
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
              Task Management
            </h1>
          </div>
          {canManageTasks ? (
            <Link
              href="/tasks/new"
              className="inline-flex items-center justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Add Task
            </Link>
          ) : null}
        </header>

        <form className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
          <label className="grid gap-2">
            <span className="text-xs font-medium uppercase tracking-normal text-slate-500">
              Status
            </span>
            <select
              name="status"
              defaultValue={filters.status ?? ""}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {formatLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-medium uppercase tracking-normal text-slate-500">
              Priority
            </span>
            <select
              name="priority"
              defaultValue={filters.priority ?? ""}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All priorities</option>
              {priorityOptions.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-medium uppercase tracking-normal text-slate-500">
              Team
            </span>
            <select
              name="teamId"
              defaultValue={sessionUser.role === "manager" ? "" : filters.teamId ?? ""}
              disabled={sessionUser.role === "manager"}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">
                {sessionUser.role === "manager" ? "Your team" : "All teams"}
              </option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-medium uppercase tracking-normal text-slate-500">
              Assigned Employee
            </span>
            <select
              name="assignedToId"
              defaultValue={isMember ? "" : filters.assignedToId ?? ""}
              disabled={isMember}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">
                {isMember ? "Own assigned tasks" : "All employees"}
              </option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-medium uppercase tracking-normal text-slate-500">
              Client
            </span>
            <select
              name="clientId"
              defaultValue={filters.clientId ?? ""}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All clients</option>
              {clientOptions.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-3 md:col-span-4 md:justify-end">
            <Link
              href="/tasks"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Reset
            </Link>
            <button
              type="submit"
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Apply Filters
            </button>
          </div>
        </form>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {tasks.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-slate-700">
                No tasks found.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Tasks will appear here after they are created.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-normal text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Title</th>
                    <th className="px-4 py-3 font-semibold">
                      Assigned Employee
                    </th>
                    <th className="px-4 py-3 font-semibold">Team</th>
                    <th className="px-4 py-3 font-semibold">Client / Work</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Priority</th>
                    <th className="px-4 py-3 font-semibold">Created On</th>
                    <th className="px-4 py-3 font-semibold">
                      <span className="sr-only">Row menu</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {tasks.map((task) => (
                    <tr key={task.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-950">
                          {task.title}
                        </div>
                        {task.description ? (
                          <div className="mt-1 whitespace-pre-line break-words text-slate-500">
                            {task.description}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {task.assignedTo?.name ?? "Unassigned"}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {task.team?.name ?? "No team"}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {task.client ? (
                          <>
                            <div className="font-medium text-slate-800">
                              {task.client.name}
                            </div>
                            {task.clientWork ? (
                              <div className="mt-1 text-xs text-slate-500">
                                {task.clientWork}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          "Internal"
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {formatLabel(task.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
                          {task.priority}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        <div>{dateFormatter.format(task.createdAt)}</div>
                        {task.updatedAt.getTime() !== task.createdAt.getTime() ? (
                          <div className="mt-1 text-xs text-slate-500">
                            Edited on {dateFormatter.format(task.updatedAt)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <ActionMenu>
                          <form action={updateOwnTaskStatus} className="grid gap-2 p-2">
                            <input type="hidden" name="id" value={task.id} />
                            <select
                              name="status"
                              defaultValue={task.status}
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                            >
                              {statusOptions.map((status) => (
                                <option key={status} value={status}>
                                  {formatLabel(status)}
                                </option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              className="rounded-md bg-slate-950 px-2 py-1 text-xs font-medium text-white"
                            >
                              Update status
                            </button>
                          </form>
                          {canManageTasks ? (
                            <Link
                              href={`/tasks/${task.id}/edit`}
                              className="rounded px-3 py-2 text-sm text-[#1F2937] transition hover:bg-[#F3E8FF] hover:text-[#770FC2]"
                            >
                              Edit
                            </Link>
                          ) : null}
                            {canDeleteTasks ? (
                              <DeleteTaskButton taskId={task.id} />
                            ) : null}
                        </ActionMenu>
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
          total={totalTasks}
          pageSize={PAGE_SIZE}
          basePath="/tasks"
          searchParams={filters}
        />
      </div>
    </DashboardLayout>
  );
}
