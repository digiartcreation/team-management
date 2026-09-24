import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserTeams, tasksOnTeams, usersOnTeams } from "@/lib/teams";
import StatCard from "@/components/dashboard/StatCard";
import TaskBoard from "@/components/dashboard/TaskBoard";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { loadTaskBoard } from "@/lib/taskBoard";

// Only used by the welcome header, which is commented out for now.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function formatRole(role?: string | null) {
  return role === "member" ? "employee" : role;
}

function todayInputValue() {
  return new Date().toLocaleDateString("en-CA");
}

export default async function ManagerDashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const sessionUser = session.user as typeof session.user & {
    id?: string;
    role?: string;
  };

  if (sessionUser.role === "member") {
    redirect("/member");
  }

  const [manager, teams] = await Promise.all([
    prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        name: true,
        role: true,
      },
    }),
    getUserTeams(sessionUser.id),
  ]);

  if (!manager || teams.length === 0) {
    return (
      <DashboardLayout>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <header className="brand-hero rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-normal text-slate-500">
              Digiart Creation
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
              Manager Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Welcome back, {session.user.name}
            </p>
          </header>
          <section className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-700">
              You are not assigned to a team yet.
            </p>
          </section>
        </div>
      </DashboardLayout>
    );
  }

  // Every team the manager runs, not just one.
  const teamIds = teams.map((team) => team.id);
  const teamTasks = tasksOnTeams(teamIds);

  const [
    backlogTasks,
    inProgressTasks,
    completedTasks,
    reopenedTasks,
    board,
    memberCount,
    teamTaskCount,
  ] = await Promise.all([
    prisma.task.count({
      where: {
        ...teamTasks,
        status: "pending",
      },
    }),
    prisma.task.count({
      where: {
        ...teamTasks,
        status: "in_progress",
      },
    }),
    prisma.task.count({
      where: {
        ...teamTasks,
        status: "completed",
      },
    }),
    prisma.task.count({
      where: {
        ...teamTasks,
        status: "reopened",
      },
    }),
    loadTaskBoard(teamTasks),
    // Distinct people, so someone on two of the manager's teams counts once.
    prisma.user.count({ where: usersOnTeams(teamIds) }),
    prisma.task.count({ where: teamTasks }),
  ]);

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* Welcome header hidden so the task board leads the page.
        <header className="brand-hero flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-normal text-slate-500">
              Digiart Creation
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
              Manager Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Welcome back, {manager.name}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-normal text-slate-500">
              Role
            </p>
            <p className="mt-1 text-sm font-semibold capitalize text-slate-950">
              {formatRole(manager.role)}
            </p>
          </div>
        </header>
        */}

        <TaskBoard
          heading="Team Task Board"
          description="Your team's tasks by stage. Drag a card to a new column to move its status."
          columns={board}
          today={todayInputValue()}
          dashboardPath="/manager"
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={teams.length === 1 ? "Assigned Team" : "Assigned Teams"}
            value={teams.length}
            description={teams.map((team) => team.name).join(", ")}
          />
          <StatCard
            label="Team Members"
            value={memberCount}
            description={teams.length === 1 ? "Employees in your team" : "Employees across your teams"}
          />
          <StatCard
            label="Team Tasks"
            value={teamTaskCount}
            description={teams.length === 1 ? "Tasks linked to your team" : "Tasks linked to your teams"}
          />
          <StatCard
            label="Backlog"
            value={backlogTasks}
            description="Team tasks not started yet"
          />
          <StatCard
            label="In Progress"
            value={inProgressTasks}
            description="Team tasks underway"
          />
          <StatCard
            label="Completed"
            value={completedTasks}
            description="Team tasks finished"
          />
          <StatCard
            label="Reopened"
            value={reopenedTasks}
            description="Sent back for rework"
          />
        </section>
      </div>
    </DashboardLayout>
  );
}
