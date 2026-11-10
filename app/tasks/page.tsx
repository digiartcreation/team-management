import Link from "next/link";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getViewerAccount } from "@/lib/viewer";
import { ACTIVE_USER, visibleTasks } from "@/lib/activeUsers";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DeleteTaskButton from "@/components/tasks/DeleteTaskButton";
import { TaskDetailsButton } from "@/components/tasks/TaskDetailsDialog";
import TaskStatusControl from "@/components/tasks/TaskStatusControl";
import {
  formatDuration,
  minutesByReopenCycle,
  splitReopenMinutes,
  summariseByUser,
} from "@/lib/duration";
import PaginationControls from "@/components/layout/PaginationControls";
import { getPage, getPagination, PAGE_SIZE } from "@/lib/pagination";
import ActionMenu from "@/components/ui/ActionMenu";
import MobileFilters from "@/components/ui/MobileFilters";
import { MobileCard, MobileCardList, MobileField } from "@/components/ui/MobileCard";
import { formatInr } from "@/lib/services";
import {
  TASK_STATUS_OPTIONS,
  formatReopenCause,
  formatTaskStatus,
  isTaskStatus,
} from "@/lib/taskStatus";
import { buildReopenHistory, countReopenNotes } from "@/lib/reopenHistory";
import { formatOfficeDate, officeInstant } from "@/lib/officeTime";
import { UNMAPPED_SERVICE, parseDateInput } from "@/lib/reportFilters";
import { UNMAPPED_SERVICE_LABEL, serviceNameOf } from "@/lib/reports";

const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function todayInputValue() {
  return new Date().toLocaleDateString("en-CA");
}

const priorityOptions = ["low", "medium", "high"];

const DAY_MS = 24 * 60 * 60 * 1000;

type TasksPageProps = {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    teamId?: string;
    assignedToId?: string;
    clientId?: string;
    service?: string;
    /** "YYYY-MM-DD": tasks created on or after that day. */
    from?: string;
    /** "YYYY-MM-DD": tasks created on or before that day. */
    to?: string;
    page?: string;
  }>;
};

const taskInclude = {
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
  timeLogs: {
    select: {
      id: true,
      minutes: true,
      date: true,
      note: true,
      reopenCycle: true,
      user: { select: { name: true } },
    },
  },
  reopens: {
    select: {
      cycle: true,
      reason: true,
      cause: true,
      createdAt: true,
      user: { select: { name: true } },
    },
  },
  watchers: {
    orderBy: { createdAt: "asc" },
    select: { user: { select: { name: true } } },
  },
} satisfies Prisma.TaskInclude;

const taskOmit = { description: true } satisfies Prisma.TaskOmit;

type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude; omit: typeof taskOmit }>;

/*
  The pieces of a task's row, shared by the table and the phone cards so the
  two always say the same thing.
*/

function watcherNames(task: TaskRow) {
  return task.watchers.map((watcher) => watcher.user.name).join(", ");
}

function reopenedTimes(count: number) {
  return `Reopened ${count} ${count === 1 ? "time" : "times"}`;
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
        status === "reopened"
          ? "bg-[#F3E8FF] text-[#770FC2]"
          : status === "closed"
            ? "bg-slate-800 text-white"
            : "bg-slate-100 text-slate-700"
      }`}
    >
      {formatTaskStatus(status)}
    </span>
  );
}

function PriorityPill({ priority }: { priority: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
      {priority}
    </span>
  );
}

function ReopenNotes({ task }: { task: TaskRow }) {
  const history = buildReopenHistory(task.reopens, task.timeLogs);

  if (history.length === 0) {
    return null;
  }

  return (
    <details className="mt-2">
      <summary className="cursor-pointer list-none text-xs font-medium text-[#770FC2] hover:underline">
        Reopen notes ({countReopenNotes(history)})
      </summary>
      <div className="mt-2 grid gap-3 border-l-2 border-[#A05DD0]/40 pl-3">
        {history.map((cycle) => (
          <div key={cycle.cycle} className="grid gap-1">
            <p className="text-xs font-semibold text-slate-700">
              Reopen {cycle.cycle}
              {cycle.minutes > 0
                ? ` -- ${formatDuration(cycle.minutes)}`
                : " -- nothing logged yet"}
              {cycle.reopenedBy ? ` -- by ${cycle.reopenedBy}` : ""}
              {formatReopenCause(cycle.cause)
                ? ` -- ${formatReopenCause(cycle.cause)}`
                : ""}
            </p>
            {cycle.reason ? (
              <p className="whitespace-pre-line break-words text-xs italic text-slate-500">
                Reason: {cycle.reason}
              </p>
            ) : null}
            {cycle.entries.map((entry) => (
              <p
                key={entry.id}
                className="whitespace-pre-line break-words text-xs text-slate-600"
              >
                {dateFormatter.format(entry.date)} --{" "}
                {formatDuration(entry.minutes)}
                {entry.userName ? ` -- ${entry.userName}` : ""}
                {entry.note ? `: ${entry.note}` : ""}
              </p>
            ))}
          </div>
        ))}
      </div>
    </details>
  );
}

function ClientWork({ task }: { task: TaskRow }) {
  if (!task.client) {
    return <>Internal</>;
  }

  return (
    <>
      <div className="font-medium text-slate-800">{task.client.name}</div>
      {task.clientWork ? (
        <div className="mt-1 text-xs text-slate-500">{task.clientWork}</div>
      ) : null}
      {task.videoWeightage === null ? null : (
        <div className="mt-1 text-xs font-medium text-[#770FC2]">
          Weightage {Number(task.videoWeightage)}
        </div>
      )}
      {task.posterCount === null ? null : (
        <div className="mt-1 text-xs font-medium text-[#770FC2]">
          {task.posterCount} {task.posterCount === 1 ? "poster" : "posters"}
        </div>
      )}
      {task.digitalMarketingAmount === null ? null : (
        <div className="mt-1 text-xs font-medium text-[#770FC2]">
          {formatInr(Number(task.digitalMarketingAmount))}
        </div>
      )}
    </>
  );
}

function TimeSpent({ task }: { task: TaskRow }) {
  if (task.timeLogs.length === 0) {
    return <span className="text-xs text-slate-400">Nothing logged</span>;
  }

  // Reopen hours still count towards the total; they are only told apart, so
  // a task that came back twice does not read as if it took that long first
  // time.
  const time = splitReopenMinutes(task.timeLogs);

  return (
    <>
      <div className="font-medium text-slate-800">
        {formatDuration(time.total)}
      </div>
      {time.reopen > 0 ? (
        <>
          <div className="mt-1 text-xs text-slate-500">
            Original {formatDuration(time.original)}
          </div>
          {minutesByReopenCycle(task.timeLogs).map((cycle) => (
            <div key={cycle.cycle} className="text-xs text-[#770FC2]">
              Reopen {cycle.cycle} {formatDuration(cycle.minutes)}
            </div>
          ))}
        </>
      ) : null}
      {summariseByUser(task.timeLogs).map((person) => (
        <div key={person.name} className="mt-1 text-xs text-slate-500">
          {person.name} {formatDuration(person.minutes)}
        </div>
      ))}
    </>
  );
}

function CreatedOn({ task }: { task: TaskRow }) {
  return (
    <>
      <div>{dateFormatter.format(task.createdAt)}</div>
      {task.updatedAt.getTime() !== task.createdAt.getTime() ? (
        <div className="mt-1 text-xs text-slate-500">
          Edited on {dateFormatter.format(task.updatedAt)}
        </div>
      ) : null}
    </>
  );
}

/** The first completion; a reopen does not move it. */
function CompletedOn({ task }: { task: TaskRow }) {
  return task.completedAt ? (
    <>{formatOfficeDate(task.completedAt)}</>
  ) : (
    <span className="text-slate-400">Not yet</span>
  );
}

function TaskActions({
  task,
  today,
  canEditTasks,
  canDeleteTasks,
  isMember,
}: {
  task: TaskRow;
  today: string;
  canEditTasks: boolean;
  canDeleteTasks: boolean;
  isMember: boolean;
}) {
  return (
    <ActionMenu trigger="Update">
      <TaskStatusControl
        taskId={task.id}
        taskTitle={task.title}
        today={today}
        status={task.status}
        reopenCount={task.reopenCount}
      />
      {canEditTasks ? (
        <Link
          href={`/tasks/${task.id}/edit`}
          className="rounded px-3 py-2 text-sm text-[#1F2937] transition hover:bg-[#F3E8FF] hover:text-[#770FC2]"
        >
          Edit
        </Link>
      ) : null}
      {/* An employee's delete would take logged hours with it. */}
      {canDeleteTasks || (isMember && task.timeLogs.length === 0) ? (
        <DeleteTaskButton taskId={task.id} />
      ) : null}
    </ActionMenu>
  );
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
  const isMember = sessionUser.role === "member";
  // An employee only sees tasks assigned to them, so every row here is theirs.
  const canEditTasks =
    sessionUser.role === "admin" || sessionUser.role === "manager" || isMember;
  const canDeleteTasks = sessionUser.role === "admin";

  const today = todayInputValue();
  const filters = await searchParams;
  const page = getPage(filters.page);
  const where: Prisma.TaskWhereInput = {};

  const currentUser =
    sessionUser.role === "manager"
      ? await getViewerAccount(sessionUser.id)
      : null;
  const managerTeamId =
    sessionUser.role === "manager" ? currentUser?.teamId ?? "__no_team__" : undefined;

  if (isMember) {
    where.assignedToId = sessionUser.id;
  } else if (sessionUser.role === "manager") {
    where.teamId = managerTeamId;
  }

  if (isTaskStatus(filters.status)) {
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

  // Every service a task has been mapped to, as on the Reports page: it fills
  // the filter and turns the chosen service back into the stored values,
  // since "Digital Marketing" has to match "Digital Marketing (SEO)" as well.
  const mappedWork = await prisma.task.findMany({
    where: { clientWork: { not: null } },
    select: { clientWork: true },
    distinct: ["clientWork"],
    orderBy: { clientWork: "asc" },
  });
  const workValues = mappedWork
    .map((task) => task.clientWork)
    .filter((work): work is string => Boolean(work));
  const serviceOptions = [
    ...new Set(
      workValues
        .map((work) => serviceNameOf(work))
        .filter((service): service is string => Boolean(service))
    ),
  ].sort((a, b) => a.localeCompare(b));

  if (filters.service === UNMAPPED_SERVICE) {
    where.clientWork = null;
  } else if (filters.service) {
    // An unknown service leaves an empty list, which matches nothing.
    where.clientWork = {
      in: workValues.filter((work) => serviceNameOf(work) === filters.service),
    };
  }

  // Created between two days on the office calendar, both included: from the
  // office's midnight that starts the first to the one after the last. Either
  // end may be left open, and a range picked backwards is turned round.
  let fromDay = parseDateInput(filters.from);
  let toDay = parseDateInput(filters.to);

  if (fromDay && toDay && fromDay > toDay) {
    [fromDay, toDay] = [toDay, fromDay];
  }

  if (fromDay || toDay) {
    where.createdAt = {
      ...(fromDay ? { gte: officeInstant(fromDay, 0) } : {}),
      ...(toDay ? { lt: officeInstant(new Date(toDay.getTime() + DAY_MS), 0) } : {}),
    };
  }

  // An inactive employee's tasks are hidden until they are made active again.
  const shownWhere = visibleTasks(where);

  const [tasks, totalTasks, employees, teams, clientOptions] = await Promise.all([
    prisma.task.findMany({
      where: shownWhere,
      ...getPagination(page),
      orderBy: {
        createdAt: "desc",
      },
      // The list never shows the description (the details dialog loads it
      // when opened), and it is unbounded TEXT.
      omit: taskOmit,
      include: taskInclude,
    }),
    prisma.task.count({ where: shownWhere }),
    prisma.user.findMany({
      where: isMember
        ? { id: sessionUser.id }
        : managerTeamId
          ? { teamId: managerTeamId, ...ACTIVE_USER }
          : ACTIVE_USER,
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
  const actionRights = { today, canEditTasks, canDeleteTasks, isMember };
  const activeFilters = [
    filters.status,
    filters.priority,
    filters.teamId,
    filters.assignedToId,
    filters.clientId,
    filters.service,
    filters.from,
    filters.to,
  ].filter(Boolean).length;

  return (
    <DashboardLayout reviewModule="tasks">
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
          {/* Everyone can add a task; editing other people's stays with managers. */}
          <Link
            href="/tasks/new"
            className="inline-flex items-center justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Add Task
          </Link>
        </header>

        <form className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
          <MobileFilters active={activeFilters}>
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
                {TASK_STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
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

            <label className="grid gap-2">
              <span className="text-xs font-medium uppercase tracking-normal text-slate-500">
                Service
              </span>
              <select
                name="service"
                defaultValue={filters.service ?? ""}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">All services</option>
                <option value={UNMAPPED_SERVICE}>{UNMAPPED_SERVICE_LABEL}</option>
                {serviceOptions.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-medium uppercase tracking-normal text-slate-500">
                From Date
              </span>
              <input
                type="date"
                name="from"
                defaultValue={filters.from ?? ""}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-medium uppercase tracking-normal text-slate-500">
                To Date
              </span>
              <input
                type="date"
                name="to"
                defaultValue={filters.to ?? ""}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <div className="flex gap-3 md:col-span-4 md:justify-end">
              {/* A plain link, a full page load like Apply: in production a
                  client-side hop that only changes the query string sometimes
                  never finishes, leaving the old filters on screen. */}
              <a
                href="/tasks"
                className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Reset
              </a>
              <button
                type="submit"
                className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Apply Filters
              </button>
            </div>
          </MobileFilters>
        </form>

        {/* Phones get cards, the list below; the table is for wider screens.
            With nothing to list, the table's empty message shows on both. */}
        <section
          className={`overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${
            tasks.length > 0 ? "hidden md:block" : ""
          }`}
        >
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
              <table className="w-full min-w-[1380px] text-left text-sm">
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
                    <th className="px-4 py-3 font-semibold">Time Spent</th>
                    <th className="px-4 py-3 font-semibold">Created On</th>
                    <th className="px-4 py-3 font-semibold">Completed On</th>
                    <th className="px-4 py-3 font-semibold">
                      <span className="sr-only">Row menu</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {tasks.map((task) => (
                    <tr key={task.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4">
                        {/* The title opens the full task, description and
                            all; the list itself stays short. */}
                        <TaskDetailsButton
                          taskId={task.id}
                          className="text-left font-medium text-slate-950 transition hover:text-[#770FC2] hover:underline"
                        >
                          {task.title}
                        </TaskDetailsButton>
                        <ReopenNotes task={task} />
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {task.assignedTo?.name ?? "Unassigned"}
                        {task.watchers.length > 0 ? (
                          <div className="mt-1 text-xs text-slate-500">
                            Watchers: {watcherNames(task)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {task.team?.name ?? "No team"}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        <ClientWork task={task} />
                      </td>
                      <td className="px-4 py-4">
                        <StatusPill status={task.status} />
                        {task.reopenCount > 0 ? (
                          <div className="mt-1 text-xs text-slate-500">
                            {reopenedTimes(task.reopenCount)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <PriorityPill priority={task.priority} />
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        <TimeSpent task={task} />
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        <CreatedOn task={task} />
                      </td>
                      {/* The first completion; a reopen does not move it. */}
                      <td className="px-4 py-4 text-slate-600">
                        <CompletedOn task={task} />
                      </td>
                      <td className="px-4 py-4">
                        <TaskActions task={task} {...actionRights} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {tasks.length > 0 ? (
          <MobileCardList>
            {tasks.map((task) => (
              <MobileCard
                key={task.id}
                title={task.title}
                subtitle={`${task.assignedTo?.name ?? "Unassigned"} · ${
                  task.client?.name ?? "Internal"
                }`}
                status={<StatusPill status={task.status} />}
                actions={
                  <>
                    <TaskDetailsButton
                      taskId={task.id}
                      className="flex h-8 items-center rounded-md bg-[#770FC2] px-3 text-sm font-medium text-white transition hover:bg-[#6B1BBD]"
                    >
                      View details
                    </TaskDetailsButton>
                    <TaskActions task={task} {...actionRights} />
                  </>
                }
              >
                <div className="grid grid-cols-2 gap-3">
                  <MobileField label="Priority">
                    <PriorityPill priority={task.priority} />
                  </MobileField>
                  <MobileField label="Team">
                    {task.team?.name ?? "No team"}
                  </MobileField>
                </div>
                <MobileField label="Assigned Employee">
                  {task.assignedTo?.name ?? "Unassigned"}
                  {task.watchers.length > 0 ? (
                    <span className="mt-0.5 block text-xs text-slate-500">
                      Watchers: {watcherNames(task)}
                    </span>
                  ) : null}
                </MobileField>
                <MobileField label="Client / Work">
                  <ClientWork task={task} />
                </MobileField>
                <MobileField label="Time Spent">
                  <TimeSpent task={task} />
                </MobileField>
                <div className="grid grid-cols-2 gap-3">
                  <MobileField label="Created On">
                    <CreatedOn task={task} />
                  </MobileField>
                  <MobileField label="Completed On">
                    <CompletedOn task={task} />
                  </MobileField>
                </div>
                {task.reopenCount > 0 ? (
                  <MobileField label="Reopened">
                    {reopenedTimes(task.reopenCount)}
                    <ReopenNotes task={task} />
                  </MobileField>
                ) : null}
              </MobileCard>
            ))}
          </MobileCardList>
        ) : null}
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
