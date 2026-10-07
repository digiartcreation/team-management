import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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

  const isMember = sessionUser.role !== "admin" && sessionUser.role !== "manager";
  // Managers and employees both edit within their own team only.
  const scopedToTeam = sessionUser.role !== "admin";

  const { id } = await params;

  const currentUser = scopedToTeam
    ? await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { teamId: true },
      })
    : null;

  const teamId = scopedToTeam ? currentUser?.teamId ?? "__no_team__" : undefined;

  const [task, employees, teams] = await Promise.all([
    prisma.task.findUnique({
      // An employee can open only the tasks assigned to them.
      where: isMember
        ? { id, assignedToId: sessionUser.id }
        : { id, ...(teamId ? { teamId } : {}) },
      select: {
        id: true,
        title: true,
        description: true,
        assignedToId: true,
        teamId: true,
        clientId: true,
        clientWork: true,
        digitalMarketingAmount: true,
        videoWeightage: true,
        posterCount: true,
        status: true,
        priority: true,
      },
    }),
    prisma.user.findMany({
      // An employee without a team can only keep the task for themselves.
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
          pendingLabel="Updating Task..."
          employees={employees}
          teams={teams}
          clients={clients}
          task={{
            ...task,
            digitalMarketingAmount: task.digitalMarketingAmount?.toNumber() ?? null,
            videoWeightage: task.videoWeightage?.toNumber() ?? null,
          }}
        />
      </div>
    </DashboardLayout>
  );
}
