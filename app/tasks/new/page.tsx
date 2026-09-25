import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TaskForm from "@/components/tasks/TaskForm";
import { createTask } from "@/app/tasks/actions";
import { getTaskClientOptions } from "@/lib/taskClients";

/** The dashboards a task can be added from, and where "Back" leads for each. */
const RETURN_PATHS: Record<string, { href: string; label: string }> = {
  "/": { href: "/", label: "Back to Dashboard" },
  "/manager": { href: "/manager", label: "Back to Dashboard" },
  "/member": { href: "/member", label: "Back to Dashboard" },
};

type NewTaskPageProps = {
  searchParams: Promise<{ from?: string }>;
};

export default async function NewTaskPage({ searchParams }: NewTaskPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const sessionUser = session.user as typeof session.user & {
    id?: string;
    role?: string;
  };
  const isAdmin = sessionUser.role === "admin";
  // Managers and employees both add work for their own team only.
  const scopedToTeam = !isAdmin;
  const isMember = sessionUser.role !== "admin" && sessionUser.role !== "manager";

  const { from } = await searchParams;
  const back = (from && RETURN_PATHS[from]) || {
    href: "/tasks",
    label: "Back to Tasks",
  };

  const currentUser = scopedToTeam
    ? await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { teamId: true },
      })
    : null;

  const teamId = scopedToTeam ? currentUser?.teamId ?? "__no_team__" : undefined;

  const [employees, teams, clients] = await Promise.all([
    prisma.user.findMany({
      // An employee without a team can still add a task -- for themselves.
      where:
        isMember && !currentUser?.teamId
          ? { id: sessionUser.id }
          : teamId
            ? { teamId }
            : undefined,
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    }),
    prisma.team.findMany({
      where: teamId ? { id: teamId } : undefined,
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
    getTaskClientOptions(),
  ]);

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header>
          <Link
            href={back.href}
            className="text-sm font-medium text-slate-500 transition hover:text-slate-950"
          >
            {back.label}
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
            Add Task
          </h1>
        </header>

        <TaskForm
          action={createTask}
          submitLabel="Create Task"
          employees={employees}
          teams={teams}
          clients={clients}
          returnTo={back.href}
          defaultAssigneeId={
            employees.some((employee) => employee.id === sessionUser.id)
              ? sessionUser.id
              : undefined
          }
          defaultTeamId={scopedToTeam ? currentUser?.teamId ?? undefined : undefined}
        />
      </div>
    </DashboardLayout>
  );
}
