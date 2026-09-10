import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TaskForm from "@/components/tasks/TaskForm";
import { createTask } from "@/app/tasks/actions";
import { getTaskClientOptions } from "@/lib/taskClients";

export default async function NewTaskPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const sessionUser = session.user as typeof session.user & {
    id?: string;
    role?: string;
  };

  if (sessionUser.role !== "admin" && sessionUser.role !== "manager") {
    redirect("/tasks");
  }

  const currentUser =
    sessionUser.role === "manager"
      ? await prisma.user.findUnique({
          where: { id: sessionUser.id },
          select: { teamId: true },
        })
      : null;

  const managerTeamId =
    sessionUser.role === "manager" ? currentUser?.teamId ?? "__no_team__" : undefined;

  const [employees, teams, clients] = await Promise.all([
    prisma.user.findMany({
      where: managerTeamId ? { teamId: managerTeamId } : undefined,
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
      where: managerTeamId ? { id: managerTeamId } : undefined,
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
            href="/tasks"
            className="text-sm font-medium text-slate-500 transition hover:text-slate-950"
          >
            Back to Tasks
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
        />
      </div>
    </DashboardLayout>
  );
}
