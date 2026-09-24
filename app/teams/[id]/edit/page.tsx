import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TeamForm from "@/components/teams/TeamForm";
import { updateTeam } from "@/app/teams/actions";

type EditTeamPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditTeamPage({ params }: EditTeamPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const sessionUser = session.user as typeof session.user & {
    role?: string;
  };

  if (sessionUser.role !== "admin") {
    redirect("/teams");
  }

  const { id } = await params;

  const [team, employees] = await Promise.all([
    prisma.team.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        members: {
          select: {
            id: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    }),
  ]);

  if (!team) {
    notFound();
  }

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header>
          <Link
            href="/teams"
            className="text-sm font-medium text-slate-500 transition hover:text-slate-950"
          >
            Back to Teams
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
            Edit Team
          </h1>
        </header>

        <TeamForm
          action={updateTeam}
          submitLabel="Update Team"
          employees={employees}
          team={team}
        />
      </div>
    </DashboardLayout>
  );
}
