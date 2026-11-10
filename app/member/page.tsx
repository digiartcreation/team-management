import { redirect } from "next/navigation";
import { getShellSession, preloadShell } from "@/lib/shell";
import { prisma } from "@/lib/prisma";
import StatCard from "@/components/dashboard/StatCard";
import TaskBoard from "@/components/dashboard/TaskBoard";
import WatchingBoard from "@/components/dashboard/WatchingBoard";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { columnTotal, loadTaskBoard, loadWatchedBoard } from "@/lib/taskBoard";

// Only used by the welcome header, which is commented out for now.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function formatRole(role?: string | null) {
  return role === "member" ? "employee" : role;
}

function todayInputValue() {
  return new Date().toLocaleDateString("en-CA");
}

export default async function MemberDashboardPage() {
  const session = await getShellSession();

  if (!session?.user) {
    redirect("/login");
  }

  preloadShell(session);

  const sessionUser = session.user as typeof session.user & {
    id?: string;
    role?: string;
  };

  if (sessionUser.role === "manager") {
    redirect("/manager");
  }

  // Spelled out rather than left as sessionUser.id: an undefined id is a
  // filter Prisma drops, which would put every task in the workspace on one
  // employee's board. No such user exists, so this matches nothing instead.
  const ownTasks = { assignedToId: sessionUser.id ?? "__no_user__" };

  const [member, board, watched] = await Promise.all([
    prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        name: true,
        role: true,
        team: {
          select: {
            name: true,
          },
        },
      },
    }),
    loadTaskBoard(ownTasks),
    loadWatchedBoard(ownTasks.assignedToId),
  ]);

  // The stat cards count the same tasks as the board's column headers.
  const backlogTasks = columnTotal(board, "pending");
  const inProgressTasks = columnTotal(board, "in_progress");
  const completedTasks = columnTotal(board, "completed");
  const reopenedTasks = columnTotal(board, "reopened");

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
              Employee Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Welcome back, {member?.name ?? session.user.name}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-normal text-slate-500">
              Role
            </p>
            <p className="mt-1 text-sm font-semibold capitalize text-slate-950">
              {formatRole(member?.role ?? sessionUser.role)}
            </p>
          </div>
        </header>
        */}

        <TaskBoard
          heading="My Task Board"
          description="Your tasks by stage. Drag a card to a new column to move its status."
          columns={board}
          today={todayInputValue()}
          dashboardPath="/member"
        />

        <WatchingBoard columns={watched} today={todayInputValue()} />

        {!member?.team ? (
          <section className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-700">
              You are not assigned to a team yet.
            </p>
          </section>
        ) : null}

        <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
          <StatCard
            label="Assigned Team"
            value={member?.team ? 1 : 0}
            description={member?.team?.name ?? "No team assigned"}
          />
          <StatCard
            label="Backlog"
            value={backlogTasks}
            description="Tasks not started yet"
          />
          <StatCard
            label="In Progress"
            value={inProgressTasks}
            description="Tasks underway"
          />
          <StatCard
            label="Completed"
            value={completedTasks}
            description="Tasks finished"
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
