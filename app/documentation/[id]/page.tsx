import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DeleteDocumentationButton from "@/components/documentation/DeleteDocumentationButton";
import {
  canManageDocumentation,
  sanitizeDocumentationHtml,
} from "@/lib/documentation";
import "ckeditor5/ckeditor5-content.css";

const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

/** How many titles the side index lists before it stops. */
const INDEX_LIMIT = 200;

type DocumentationViewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DocumentationViewPage({
  params,
}: DocumentationViewPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const sessionUser = session.user as typeof session.user & {
    id?: string;
    role?: string;
  };

  const { id } = await params;

  const [doc, index] = await Promise.all([
    prisma.documentation.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        content: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { name: true } },
      },
    }),
    prisma.documentation.findMany({
      orderBy: { title: "asc" },
      take: INDEX_LIMIT,
      select: { id: true, title: true },
    }),
  ]);

  if (!doc) {
    notFound();
  }

  const canManage = canManageDocumentation(sessionUser, doc);
  // Cleaned on save as well; again here so a row written any other way still
  // cannot put script in front of the reader.
  const html = sanitizeDocumentationHtml(doc.content);

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Link
          href="/documentation"
          className="text-sm font-medium text-slate-500 transition hover:text-slate-950"
        >
          Back to Documentation
        </Link>

        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <nav
            aria-label="Documentation pages"
            className="hidden self-start rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-6 lg:block"
          >
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Pages
            </p>
            <ul className="grid max-h-[70vh] gap-0.5 overflow-y-auto">
              {index.map((entry) => (
                <li key={entry.id}>
                  <Link
                    href={`/documentation/${entry.id}`}
                    aria-current={entry.id === doc.id ? "page" : undefined}
                    className={`block break-words rounded px-2 py-1.5 text-sm transition ${
                      entry.id === doc.id
                        ? "bg-[#F3E8FF] font-medium text-[#770FC2]"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                  >
                    {entry.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h1 className="break-words text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">
                  {doc.title}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  {doc.createdBy?.name ?? "Former employee"} · Created{" "}
                  {dateFormatter.format(doc.createdAt)}
                  {doc.updatedAt.getTime() !== doc.createdAt.getTime()
                    ? ` · Updated ${dateFormatter.format(doc.updatedAt)}`
                    : null}
                </p>
              </div>
              {canManage ? (
                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                  <Link
                    href={`/documentation/${doc.id}/edit`}
                    className="inline-flex items-center justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    Edit
                  </Link>
                  <DeleteDocumentationButton id={doc.id} />
                </div>
              ) : null}
            </header>

            <div
              className="ck-content doc-content mt-6"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </article>
        </div>
      </div>
    </DashboardLayout>
  );
}
