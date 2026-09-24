import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DeleteTeamButton from "@/components/teams/DeleteTeamButton";
import PaginationControls from "@/components/layout/PaginationControls";
import { getPage, getPagination, PAGE_SIZE } from "@/lib/pagination";
import ActionMenu from "@/components/ui/ActionMenu";

const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

type TeamsPageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function TeamsPage({ searchParams }: TeamsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const sessionUser = session.user as typeof session.user & {
    role?: string;
  };
  const isAdmin = sessionUser.role === "admin";

  const params = await searchParams;
  const page = getPage(params.page);
  const [teams, totalTeams] = await Promise.all([
    prisma.team.findMany({
      ...getPagination(page),
      orderBy: {
        createdAt: "desc",
      },
      include: {
        members: {
          select: {
            id: true,
            name: true,
          },
          orderBy: {
            name: "asc",
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
    }),
    prisma.team.count(),
  ]);

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-normal text-slate-500">
              Teams
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
              Digiart Creation
            </h1>
          </div>
          {isAdmin ? (
            <Link
              href="/teams/new"
              className="inline-flex items-center justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Add Team
            </Link>
          ) : null}
        </header>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {teams.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-slate-700">
                No teams found.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Teams will appear here after they are created.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-normal text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Description</th>
                    <th className="px-4 py-3 font-semibold">Member Count</th>
                    <th className="px-4 py-3 font-semibold">Created On</th>
                    <th className="px-4 py-3 font-semibold">
                      <span className="sr-only">Row menu</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {teams.map((team) => (
                    <tr key={team.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4 font-medium text-slate-950">
                        {team.name}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        <div className="whitespace-pre-line break-words">
                          {team.description || "No description"}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {team.members.length > 0
                            ? team.members
                                .map((member) => member.name)
                                .join(", ")
                            : "No members assigned"}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {team._count.members}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {dateFormatter.format(team.createdAt)}
                      </td>
                      <td className="px-4 py-4">
                        {isAdmin ? (
                          <ActionMenu>
                            <Link
                              href={`/teams/${team.id}/edit`}
                              className="rounded px-3 py-2 text-sm text-[#1F2937] transition hover:bg-[#F3E8FF] hover:text-[#770FC2]"
                            >
                              Edit
                            </Link>
                            <DeleteTeamButton teamId={team.id} />
                          </ActionMenu>
                        ) : (
                          <span className="text-sm text-slate-400">
                            View only
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <PaginationControls
          page={page}
          total={totalTeams}
          pageSize={PAGE_SIZE}
          basePath="/teams"
          searchParams={params}
        />
      </div>
    </DashboardLayout>
  );
}
