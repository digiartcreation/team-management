import Link from "next/link";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PaginationControls from "@/components/layout/PaginationControls";
import { getPage, getPagination, PAGE_SIZE } from "@/lib/pagination";
import ModuleReviewMarker from "@/components/layout/ModuleReviewMarker";
import ActionMenu from "@/components/ui/ActionMenu";
import DeleteMenuAction from "@/components/ui/DeleteMenuAction";
import { deleteLearning } from "@/app/learnings/actions";

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  day: "numeric",
  month: "short",
});

type LearningsPageProps = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

export default async function LearningsPage({
  searchParams,
}: LearningsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const sessionUser = session.user as typeof session.user & {
    id?: string;
    role?: string;
  };
  const { q } = await searchParams;
  const page = getPage((await searchParams).page);
  const showEmployeeColumn = sessionUser.role !== "member";
  const currentUser =
    sessionUser.role === "manager"
      ? await prisma.user.findUnique({
          where: { id: sessionUser.id },
          select: { teamId: true },
        })
      : null;

  const where: Prisma.LearningWhereInput =
    sessionUser.role === "admin"
      ? {}
      : sessionUser.role === "manager"
        ? { user: { teamId: currentUser?.teamId ?? "__no_team__" } }
        : { userId: sessionUser.id };

  if (q?.trim()) {
    where.title = { contains: q.trim() };
  }

  const [learnings, totalLearnings] = await Promise.all([
    prisma.learning.findMany({
      where,
      ...getPagination(page),
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true } },
      },
    }),
    prisma.learning.count({ where }),
  ]);

  return (
    <DashboardLayout>
      <ModuleReviewMarker module="learnings" />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-normal text-slate-500">
              Learnings
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
              Learnings Tracker
            </h1>
          </div>
          {sessionUser.role !== "admin" ? (
            <Link
              href="/learnings/new"
              className="inline-flex items-center justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white"
            >
              Add Learning
            </Link>
          ) : null}
        </header>

        <form className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search by title"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white"
            >
              Search
            </button>
            <Link
              href="/learnings"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Reset
            </Link>
          </div>
        </form>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {learnings.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-slate-700">
                No learnings found.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Learnings will appear here after they are added.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-normal text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Title</th>
                    {showEmployeeColumn ? (
                      <th className="px-4 py-3 font-semibold">Employee</th>
                    ) : null}
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">Reference</th>
                    <th className="px-4 py-3 font-semibold">Created On</th>
                    <th className="px-4 py-3 font-semibold">
                      <span className="sr-only">Row menu</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {learnings.map((learning) => (
                    <tr key={learning.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-950">
                          {learning.title}
                        </div>
                        <div className="mt-1 whitespace-pre-line break-words text-slate-500">
                          {learning.description}
                        </div>
                      </td>
                      {showEmployeeColumn ? (
                        <td className="px-4 py-4 text-slate-600">
                          {learning.user.name}
                        </td>
                      ) : null}
                      <td className="px-4 py-4 text-slate-600">
                        {learning.category}
                      </td>
                      <td className="px-4 py-4">
                        {learning.referenceLink ? (
                          <a
                            href={learning.referenceLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-slate-700 hover:text-slate-950"
                          >
                            Open
                          </a>
                        ) : (
                          <span className="text-sm text-slate-400">None</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-slate-600">
                          {dateFormatter.format(learning.createdAt)}
                        </div>
                        {learning.updatedAt.getTime() !== learning.createdAt.getTime() ? (
                          <div className="mt-1 text-xs text-slate-500">
                            Edited on {dateFormatter.format(learning.updatedAt)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        {learning.user.id === sessionUser.id ? (
                          <ActionMenu>
                            <Link
                              href={`/learnings/${learning.id}/edit`}
                              className="rounded px-3 py-2 text-sm text-[#1F2937] transition hover:bg-[#F3E8FF] hover:text-[#770FC2]"
                            >
                              Edit
                            </Link>
                            <DeleteMenuAction
                              id={learning.id}
                              action={deleteLearning}
                              message="Are you sure you want to delete this learning?"
                            />
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
          total={totalLearnings}
          pageSize={PAGE_SIZE}
          basePath="/learnings"
          searchParams={await searchParams}
        />
      </div>
    </DashboardLayout>
  );
}
