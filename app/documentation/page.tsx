import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PaginationControls from "@/components/layout/PaginationControls";
import ActionMenu from "@/components/ui/ActionMenu";
import DeleteMenuAction from "@/components/ui/DeleteMenuAction";
import { getPage, getPagination, PAGE_SIZE } from "@/lib/pagination";
import { canManageDocumentation, documentationText } from "@/lib/documentation";
import { deleteDocumentation } from "@/app/documentation/actions";

const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

/** How much of a page's text its card previews. */
const PREVIEW_LENGTH = 220;

type DocumentationPageProps = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

export default async function DocumentationListPage({
  searchParams,
}: DocumentationPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const sessionUser = session.user as typeof session.user & {
    id?: string;
    role?: string;
  };

  const params = await searchParams;
  const page = getPage(params.page);
  const q = params.q?.trim();

  // Every page is open to everyone; the search runs over heading and body.
  const where: Prisma.DocumentationWhereInput = q
    ? { OR: [{ title: { contains: q } }, { content: { contains: q } }] }
    : {};

  const [pages, totalPages] = await Promise.all([
    prisma.documentation.findMany({
      where,
      ...getPagination(page),
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        content: true,
        createdById: true,
        updatedAt: true,
        createdBy: { select: { name: true } },
      },
    }),
    prisma.documentation.count({ where }),
  ]);

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-normal text-slate-500">
              Documentation
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
              Team Documentation
            </h1>
          </div>
          <Link
            href="/documentation/new"
            className="inline-flex items-center justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            New Page
          </Link>
        </header>

        <form className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Search headings and content"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white"
            >
              Search
            </button>
            <Link
              href="/documentation"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Reset
            </Link>
          </div>
        </form>

        {pages.length === 0 ? (
          <section className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-700">
              {q ? "No pages match that search." : "No documentation yet."}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {q
                ? "Try other words, or reset the search."
                : "Pages will appear here once someone writes the first one."}
            </p>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2">
            {pages.map((doc) => {
              const text = documentationText(doc.content);
              const preview =
                text.length > PREVIEW_LENGTH
                  ? `${text.slice(0, PREVIEW_LENGTH).trimEnd()}...`
                  : text;

              return (
                <article
                  key={doc.id}
                  className="flex flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#A05DD0]/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/documentation/${doc.id}`}
                      className="min-w-0 break-words text-base font-semibold text-slate-950 hover:text-[#770FC2]"
                    >
                      {doc.title}
                    </Link>
                    {canManageDocumentation(sessionUser, doc) ? (
                      <ActionMenu>
                        <Link
                          href={`/documentation/${doc.id}/edit`}
                          className="rounded px-3 py-2 text-sm text-[#1F2937] transition hover:bg-[#F3E8FF] hover:text-[#770FC2]"
                        >
                          Edit
                        </Link>
                        <DeleteMenuAction
                          id={doc.id}
                          action={deleteDocumentation}
                          message="Are you sure you want to delete this page?"
                        />
                      </ActionMenu>
                    ) : null}
                  </div>
                  {preview ? (
                    <p className="mt-2 line-clamp-3 break-words text-sm text-slate-600">
                      {preview}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm italic text-slate-400">
                      Images only
                    </p>
                  )}
                  <p className="mt-auto pt-4 text-xs text-slate-500">
                    {doc.createdBy?.name ?? "Former employee"} · Updated{" "}
                    {dateFormatter.format(doc.updatedAt)}
                  </p>
                </article>
              );
            })}
          </section>
        )}

        <PaginationControls
          page={page}
          total={totalPages}
          pageSize={PAGE_SIZE}
          basePath="/documentation"
          searchParams={params}
        />
      </div>
    </DashboardLayout>
  );
}
