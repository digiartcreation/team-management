import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import StatCard from "@/components/dashboard/StatCard";
import TaskBoard from "@/components/dashboard/TaskBoard";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { loadTaskBoard } from "@/lib/taskBoard";
import { createBroadcastNotification } from "@/app/notifications/actions";
import TextareaWithBullet from "@/components/ui/TextareaWithBullet";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const [
    totalUsers,
    totalTeams,
    totalTasks,
    backlogTasks,
    inProgressTasks,
    completedTasks,
    reopenedTasks,
    board,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.team.count(),
    prisma.task.count(),
    prisma.task.count({
      where: {
        status: "pending",
      },
    }),
    prisma.task.count({
      where: {
        status: "in_progress",
      },
    }),
    prisma.task.count({
      where: {
        status: "completed",
      },
    }),
    prisma.task.count({
      where: {
        status: "reopened",
      },
    }),
    // No filter: an admin sees every team's work on the board.
    loadTaskBoard({}),
  ]);

  const sessionUser = session.user as typeof session.user & {
    role?: string;
  };

  if (sessionUser.role === "manager") {
    redirect("/manager");
  }

  if (sessionUser.role === "member") {
    redirect("/member");
  }

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="brand-hero flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-normal text-slate-500">
              Digiart Creation
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
              Admin Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Welcome back, {session.user.name}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-normal text-slate-500">
              Role
            </p>
            <p className="mt-1 text-sm font-semibold capitalize text-slate-950">
              {sessionUser.role}
            </p>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="Total Users"
            value={totalUsers}
            description="Registered employees and admins"
          />
          <StatCard
            label="Total Teams"
            value={totalTeams}
            description="Active team records"
          />
          <StatCard
            label="Total Tasks"
            value={totalTasks}
            description="All tracked work items"
          />
          <StatCard
            label="Backlog"
            value={backlogTasks}
            description="Tasks waiting for action"
          />
          <StatCard
            label="In Progress"
            value={inProgressTasks}
            description="Tasks currently being worked on"
          />
          <StatCard
            label="Completed"
            value={completedTasks}
            description="Tasks finished by the team"
          />
          <StatCard
            label="Reopened"
            value={reopenedTasks}
            description="Completed tasks sent back for rework"
          />
        </section>

        <TaskBoard
          heading="Task Board"
          description="Every team's tasks by stage. Read-only here -- move them from the Tasks page."
          columns={board}
        />

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium uppercase tracking-normal text-slate-500">
              Create Notification
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Broadcast to workspace
            </h2>
          </div>
          <form action={createBroadcastNotification} className="mt-5 grid gap-4">
            <input
              name="title"
              placeholder="Title"
              required
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <TextareaWithBullet
              name="message"
              required
              rows={3}
              className="resize-none rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="grid gap-4 md:grid-cols-3">
              <select
                name="audience"
                required
                defaultValue="everyone"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="employees">Employees</option>
                <option value="managers">Managers</option>
                <option value="everyone">Everyone</option>
              </select>
              <input
                name="expiresAt"
                type="date"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
                <input type="checkbox" name="important" />
                Important
              </label>
            </div>
            <div>
              <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">
                Create Notification
              </button>
            </div>
          </form>
        </section>
      </div>
    </DashboardLayout>
  );
}
