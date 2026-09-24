import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserTeamIds, scopeIds, tasksOnTeams, usersOnTeams } from "@/lib/teams";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TaskForm from "@/components/tasks/TaskForm";
import { updateTask } from "@/app/tasks/actions";
import { getTaskClientOptions } from "@/lib/taskClients";

type EditTaskPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditTaskPage({ params }: EditTaskPageProps) {
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

  const { id } = await params;

  // Undefined for an admin; a manager edits within any team they run.
  const managerTeamIds =
    sessionUser.role === "manager" ? await getUserTeamIds(sessionUser.id) : undefined;

  const [task, employees, teams] = await Promise.all([
    prisma.task.findFirst({
      where: { id, ...(managerTeamIds ? tasksOnTeams(managerTeamIds) : {}) },
      select: {
        id: true,
        title: true,
        description: true,
        assignedToId: true,
        teamId: true,
        clientId: true,
        clientWork: true,
        digitalMarketingAmount: true,
        status: true,
        priority: true,
      },
    }),
    prisma.user.findMany({
      where: managerTeamIds ? usersOnTeams(managerTeamIds) : undefined,
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
      where: managerTeamIds ? { id: { in: scopeIds(managerTeamIds) } } : undefined,
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
  ]);

  if (!task) {
    notFound();
  }

  // Needs task.clientId, so it cannot join the Promise.all above.
  const clients = await getTaskClientOptions(task.clientId);

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
            Edit Task
          </h1>
        </header>

        <TaskForm
          action={updateTask}
          submitLabel="Update Task"
          employees={employees}
          teams={teams}
          clients={clients}
          task={{
            ...task,
            digitalMarketingAmount: task.digitalMarketingAmount?.toNumber() ?? null,
          }}
        />
      </div>
    </DashboardLayout>
  );
}
