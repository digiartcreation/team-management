import Link from "next/link";
import { redirect } from "next/navigation";
import { taskDescriptionText } from "@/lib/taskDescription";
import { getShellSession, preloadShell } from "@/lib/shell";
import { prisma } from "@/lib/prisma";
import { getViewerAccount } from "@/lib/viewer";
import { ACTIVE_USER, OWNED_BY_ACTIVE_USER, visibleTasks } from "@/lib/activeUsers";
import { getTeamOptions } from "@/lib/filterOptions";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { formatTaskStatus } from "@/lib/taskStatus";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    module?: string;
    dateFrom?: string;
    dateTo?: string;
    role?: string;
    teamId?: string;
  }>;
};

function ResultSection({ title, items }: { title: string; items: { id: string; label: string; href: string; description?: string }[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      {items.length === 0 ? <p className="mt-4 text-sm text-slate-500">No matches.</p> : <div className="mt-4 grid gap-3">{items.map((item) => <Link key={item.id} href={item.href} className="rounded-md border border-slate-200 p-3 transition hover:bg-slate-50"><div className="whitespace-pre-line break-words font-medium text-slate-950">{item.label}</div>{/* Folded to three lines on a phone; the result opens the full entry. */}{item.description ? <div className="mt-1 whitespace-pre-line break-words text-sm text-slate-500 max-md:line-clamp-3">{item.description}</div> : null}</Link>)}</div>}
    </section>
  );
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const session = await getShellSession();
  if (!session?.user) redirect("/login");
  preloadShell(session);
  const sessionUser = session.user as typeof session.user & { id?: string; role?: string };
  const { q, module, dateFrom, dateTo, role, teamId } = await searchParams;
  const query = q?.trim() ?? "";
  const currentUser =
    sessionUser.role === "manager" || sessionUser.role === "member"
      ? await getViewerAccount(sessionUser.id)
      : null;
  const memberScope = sessionUser.role === "member";
  const managerTeamId = sessionUser.role === "manager" ? currentUser?.teamId ?? "__no_team__" : undefined;
  const memberTeamId = memberScope ? currentUser?.teamId ?? "__no_team__" : undefined;
  const selectedTeamId = sessionUser.role === "admin" && teamId ? teamId : managerTeamId;
  // A date that is not a real "YYYY-MM-DD" is left out rather than reaching
  // the database as an invalid date, which showed the error page.
  const validDay = (value?: string) =>
    value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
      ? value
      : undefined;
  const fromDay = validDay(dateFrom);
  const toDay = validDay(dateTo);
  const createdAt =
    fromDay || toDay
      ? {
          ...(fromDay ? { gte: new Date(`${fromDay}T00:00:00.000Z`) } : {}),
          ...(toDay ? { lte: new Date(`${toDay}T23:59:59.999Z`) } : {}),
        }
      : undefined;
  // An inactive employee's work is hidden until they are made active again;
  // admins still find the person, as on the Employees page, to reactivate them.
  const userWhere = memberScope ? { id: sessionUser.id } : sessionUser.role === "manager" ? { teamId: managerTeamId, ...ACTIVE_USER } : { ...(role ? { role } : {}), ...(selectedTeamId ? { teamId: selectedTeamId } : {}) };
  const ownedWhere = memberScope ? { userId: sessionUser.id } : sessionUser.role === "manager" ? { user: { teamId: managerTeamId, ...ACTIVE_USER } } : selectedTeamId ? { user: { teamId: selectedTeamId, ...ACTIVE_USER } } : OWNED_BY_ACTIVE_USER;
  const taskWhere = memberScope ? { assignedToId: sessionUser.id } : sessionUser.role === "manager" ? { teamId: managerTeamId } : selectedTeamId ? { teamId: selectedTeamId } : {};
  const includeModule = (name: string) => !module || module === name;
  // The cached team list (lib/filterOptions.ts): same teams, same order.
  const teamsForFilter = sessionUser.role === "admin" ? await getTeamOptions() : [];
  const teamWhere =
    sessionUser.role === "admin"
      ? { ...(createdAt ? { createdAt } : {}), ...(selectedTeamId ? { id: selectedTeamId } : {}), name: { contains: query } }
      : { id: sessionUser.role === "manager" ? managerTeamId : memberTeamId, name: { contains: query } };
  const [users, teams, tasks, updates, learnings, tools, activity] = query
    ? await Promise.all([
        // Only the fields a result shows: not the whole row, password hash included.
        includeModule("employees") ? prisma.user.findMany({ where: { ...userWhere, ...(createdAt ? { createdAt } : {}), OR: [{ name: { contains: query } }, { email: { contains: query } }] }, select: { id: true, name: true, email: true }, take: 5 }) : [],
        includeModule("teams") ? prisma.team.findMany({ where: teamWhere, take: 5 }) : [],
        includeModule("tasks") ? prisma.task.findMany({ where: visibleTasks({ ...taskWhere, ...(createdAt ? { createdAt } : {}), title: { contains: query } }), take: 5 }) : [],
        includeModule("updates") ? prisma.dailyUpdate.findMany({ where: { ...ownedWhere, ...(createdAt ? { createdAt } : {}), todaysTasks: { contains: query } }, include: { user: { select: { name: true } } }, take: 5 }) : [],
        includeModule("learnings") ? prisma.learning.findMany({ where: { ...ownedWhere, ...(createdAt ? { createdAt } : {}), title: { contains: query } }, include: { user: { select: { name: true } } }, take: 5 }) : [],
        includeModule("tools") ? prisma.toolUsage.findMany({ where: { ...ownedWhere, ...(createdAt ? { createdAt } : {}), toolName: { contains: query } }, include: { user: { select: { name: true } } }, take: 5 }) : [],
        includeModule("activity") ? prisma.activityLog.findMany({ where: { ...ownedWhere, ...(createdAt ? { createdAt } : {}), description: { contains: query } }, include: { user: { select: { name: true } } }, take: 5 }) : [],
      ])
    : [[], [], [], [], [], [], []];
  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header><p className="text-sm font-medium uppercase text-slate-500">Search</p><h1 className="mt-2 text-2xl font-semibold text-slate-950">Global Search</h1></header>
        <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-4"><input name="q" defaultValue={query} placeholder="Search..." className="rounded-md border border-slate-300 px-3 py-2 text-sm lg:col-span-2" /><select name="module" defaultValue={module ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="">All modules</option><option value="employees">Employees</option><option value="teams">Teams</option><option value="tasks">Tasks</option><option value="updates">Updates</option><option value="learnings">Learnings</option><option value="tools">Tools</option><option value="activity">Activity</option></select><select name="role" defaultValue={role ?? ""} disabled={sessionUser.role !== "admin"} className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="">All roles</option><option value="admin">Admin</option><option value="manager">Manager</option><option value="member">Employee</option></select><input name="dateFrom" type="date" defaultValue={dateFrom ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm" /><input name="dateTo" type="date" defaultValue={dateTo ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm" /><select name="teamId" defaultValue={teamId ?? ""} disabled={sessionUser.role !== "admin"} className="rounded-md border border-slate-300 px-3 py-2 text-sm"><option value="">All teams</option>{teamsForFilter.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">Search</button></form>
        {!query ? <section className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Enter a search term to find records.</section> : <div className="grid gap-4 lg:grid-cols-2"><ResultSection title="Employees" items={users.map((u) => ({ id: u.id, label: u.name, href: "/employees", description: u.email }))} /><ResultSection title="Teams" items={teams.map((t) => ({ id: t.id, label: t.name, href: "/teams", description: t.description ?? undefined }))} /><ResultSection title="Tasks" items={tasks.map((t) => ({ id: t.id, label: t.title, href: "/tasks", description: [formatTaskStatus(t.status), taskDescriptionText(t.description)].filter(Boolean).join("\n\n") }))} /><ResultSection title="Updates" items={updates.map((u) => ({ id: u.id, label: u.todaysTasks, href: "/updates", description: sessionUser.role === "member" ? undefined : u.user.name }))} /><ResultSection title="Learnings" items={learnings.map((l) => ({ id: l.id, label: l.title, href: "/learnings", description: sessionUser.role === "member" ? l.description : `${l.user.name}\n\n${l.description}` }))} /><ResultSection title="Tools" items={tools.map((t) => ({ id: t.id, label: t.toolName, href: "/tools", description: sessionUser.role === "member" ? [t.purpose, t.outcome].filter(Boolean).join("\n\n") : [t.user.name, t.purpose, t.outcome].filter(Boolean).join("\n\n") }))} /><ResultSection title="Activity" items={activity.map((a) => ({ id: a.id, label: a.description, href: "/activity", description: sessionUser.role === "member" ? undefined : a.user.name }))} /></div>}
      </div>
    </DashboardLayout>
  );
}
