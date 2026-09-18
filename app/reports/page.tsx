import { Fragment } from "react";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import StatCard from "@/components/dashboard/StatCard";
import { formatDuration, totalMinutes } from "@/lib/duration";
import {
  DEFAULT_REPORT_VIEW,
  REPORT_VIEWS,
  REPORT_VIEW_DEFINITIONS,
  UNMAPPED_SERVICE_LABEL,
  buildReport,
  countDistinctClients,
  countDistinctServices,
  countDistinctTasks,
  groupTimeByPerson,
  isReportView,
  serviceNameOf,
} from "@/lib/reports";

type ReportFilters = {
  from?: string;
  to?: string;
  clientId?: string;
  userId?: string;
  service?: string;
  view?: string;
};

type ReportsPageProps = {
  searchParams: Promise<ReportFilters>;
};

/** Marks the "no service mapped" choice in the service filter. */
const UNMAPPED_SERVICE = "__unmapped__";

/** Accepts only the "YYYY-MM-DD" a date input produces. */
function parseDateInput(raw: string | undefined) {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  const date = new Date(`${raw}T00:00:00.000Z`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function endOfDay(raw: string) {
  return new Date(`${raw}T23:59:59.999Z`);
}

/** Keeps the current filters on a link, dropping the ones left blank. */
function reportHref(filters: ReportFilters) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      search.set(key, value);
    }
  }

  const query = search.toString();

  return query ? `/reports?${query}` : "/reports";
}

const inputClass = "rounded-md border border-slate-300 px-3 py-2 text-sm";

const labelClass =
  "text-xs font-medium uppercase tracking-normal text-slate-500";

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const sessionUser = session.user as typeof session.user & {
    role?: string;
  };

  if (sessionUser.role !== "admin") {
    redirect("/");
  }

  const filters = await searchParams;
  const view = isReportView(filters.view) ? filters.view : DEFAULT_REPORT_VIEW;
  const definition = REPORT_VIEW_DEFINITIONS[view];
  const from = parseDateInput(filters.from);
  const to = parseDateInput(filters.to);

  // Every service a task has actually been mapped to. It both fills the filter
  // and turns the chosen service back into the exact stored values, since
  // "Digital Marketing" has to match "Digital Marketing (SEO)" as well.
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

  const where: Prisma.TaskTimeLogWhereInput = {};

  if (from || to) {
    where.date = {
      ...(from ? { gte: from } : {}),
      // Inclusive of the chosen day, whatever time the entry carries.
      ...(to && filters.to ? { lte: endOfDay(filters.to) } : {}),
    };
  }

  const taskFilter: Prisma.TaskWhereInput = {};

  if (filters.clientId) {
    taskFilter.clientId =
      filters.clientId === "__internal__" ? null : filters.clientId;
  }

  if (filters.service === UNMAPPED_SERVICE) {
    taskFilter.clientWork = null;
  } else if (filters.service) {
    // An unknown service leaves an empty list, which matches nothing.
    taskFilter.clientWork = {
      in: workValues.filter((work) => serviceNameOf(work) === filters.service),
    };
  }

  if (Object.keys(taskFilter).length > 0) {
    where.task = taskFilter;
  }

  if (filters.userId) {
    where.userId = filters.userId;
  }

  const [logs, clientOptions, userOptions] = await Promise.all([
    prisma.taskTimeLog.findMany({
      where,
      select: {
        minutes: true,
        user: { select: { id: true, name: true } },
        task: {
          select: {
            id: true,
            title: true,
            clientWork: true,
            client: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
  ]);

  const groups = buildReport(logs, view);
  const byPerson = groupTimeByPerson(logs);
  const total = totalMinutes(logs);

  // First column, the detail columns, an optional person column, then time.
  const columnCount =
    2 + definition.detailHeadings.length + (definition.showPeople ? 1 : 0);

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header>
          <p className="text-sm font-medium uppercase tracking-normal text-slate-500">
            Reports
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
            {definition.heading}
          </h1>
          <p className="mt-2 text-sm text-slate-500">{definition.description}</p>
        </header>

        <nav className="flex flex-wrap gap-2">
          {REPORT_VIEWS.map((option) => (
            <Link
              key={option}
              href={reportHref({ ...filters, view: option })}
              className={`rounded-md px-4 py-2 text-sm font-medium transition duration-200 ${
                option === view
                  ? "bg-[#6B1BBD] text-white shadow-sm"
                  : "border border-slate-300 text-slate-700 hover:bg-[#F3E8FF] hover:text-[#770FC2]"
              }`}
            >
              {REPORT_VIEW_DEFINITIONS[option].tab}
            </Link>
          ))}
        </nav>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard
            label="Total time"
            value={formatDuration(total)}
            description="Across every task in range"
          />
          <StatCard
            label="Clients"
            value={countDistinctClients(logs)}
            description="With time logged"
          />
          <StatCard
            label="Services"
            value={countDistinctServices(logs)}
            description="Worked on in range"
          />
          <StatCard
            label="Tasks"
            value={countDistinctTasks(logs)}
            description="Worked on in range"
          />
          <StatCard
            label="Employees"
            value={byPerson.length}
            description="Who logged time"
          />
        </div>

        <form className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
          {/* Keeps the chosen report when the filters are applied. */}
          <input type="hidden" name="view" value={view} />

          <label className="grid gap-2">
            <span className={labelClass}>From</span>
            <input
              name="from"
              type="date"
              defaultValue={filters.from ?? ""}
              className={inputClass}
            />
          </label>

          <label className="grid gap-2">
            <span className={labelClass}>To</span>
            <input
              name="to"
              type="date"
              defaultValue={filters.to ?? ""}
              className={inputClass}
            />
          </label>

          <label className="grid gap-2">
            <span className={labelClass}>Client</span>
            <select
              name="clientId"
              defaultValue={filters.clientId ?? ""}
              className={inputClass}
            >
              <option value="">All clients</option>
              <option value="__internal__">Internal (no client)</option>
              {clientOptions.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className={labelClass}>Service</span>
            <select
              name="service"
              defaultValue={filters.service ?? ""}
              className={inputClass}
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
            <span className={labelClass}>Employee</span>
            <select
              name="userId"
              defaultValue={filters.userId ?? ""}
              className={inputClass}
            >
              <option value="">All employees</option>
              {userOptions.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-3 md:col-span-4 md:justify-end">
            <Link
              href={reportHref({ view })}
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
          {groups.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-slate-700">
                No time logged.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Log time from the row menu on the Tasks page and it will appear
                here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table
                className={`w-full text-left text-sm ${
                  columnCount > 4 ? "min-w-[980px]" : "min-w-[860px]"
                }`}
              >
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-normal text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">
                      {definition.groupHeading}
                    </th>
                    {definition.detailHeadings.map((heading) => (
                      <th key={heading} className="px-4 py-3 font-semibold">
                        {heading}
                      </th>
                    ))}
                    {definition.showPeople ? (
                      <th className="px-4 py-3 font-semibold">Person</th>
                    ) : null}
                    <th className="px-4 py-3 text-right font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {groups.map((group) => (
                    <Fragment key={group.key}>
                      <tr className="bg-[#F8F7FB]">
                        <td
                          className="px-4 py-3 font-semibold text-[#770FC2]"
                          colSpan={columnCount - 1}
                        >
                          {group.label}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-[#770FC2]">
                          {formatDuration(group.minutes)}
                        </td>
                      </tr>

                      {group.tasks.map((task) => (
                        <tr
                          key={task.taskId}
                          className="align-top hover:bg-slate-50"
                        >
                          <td className="px-4 py-4 pl-8 font-medium text-slate-950">
                            {task.title}
                          </td>
                          {task.details.map((detail, index) => (
                            <td
                              key={definition.detailHeadings[index]}
                              className="px-4 py-4 text-slate-600"
                            >
                              {detail ?? (
                                <span className="text-xs text-slate-400">
                                  Not mapped
                                </span>
                              )}
                            </td>
                          ))}
                          {definition.showPeople ? (
                            <td className="px-4 py-4 text-slate-600">
                              {task.people.map((person) => (
                                <div key={person.userId}>{person.name}</div>
                              ))}
                            </td>
                          ) : null}
                          <td className="px-4 py-4 text-right text-slate-600">
                            <div className="font-medium text-slate-800">
                              {formatDuration(task.minutes)}
                            </div>
                            {definition.showPeople && task.people.length > 1
                              ? task.people.map((person) => (
                                  <div
                                    key={person.userId}
                                    className="text-xs text-slate-500"
                                  >
                                    {formatDuration(person.minutes)}
                                  </div>
                                ))
                              : null}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* On the employee report the groups above already are the per-person totals. */}
        {view !== "employee" && byPerson.length > 0 ? (
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-950">
                Total by person
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-slate-200">
                  {byPerson.map((person) => (
                    <tr key={person.userId} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-950">
                        {person.name}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatDuration(person.minutes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
