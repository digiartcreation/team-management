import Link from "next/link";
import BackLink from "@/components/ui/BackLink";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { sanitizeDocumentationHtml } from "@/lib/documentation";
import { formatFileSize } from "@/lib/uploads";
import "ckeditor5/ckeditor5-content.css";

type ClientSopPageProps = {
  params: Promise<{ id: string }>;
};

/** A client's SOP as written on the client form, with its file if it has one. */
export default async function ClientSopPage({ params }: ClientSopPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const sessionUser = session.user as typeof session.user & {
    role?: string;
  };

  if (sessionUser.role !== "admin") {
    redirect("/");
  }

  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      sopContent: true,
      sop: { select: { fileName: true, size: true } },
    },
  });

  if (!client) {
    notFound();
  }

  // Cleaned on save as well; again here so a row written any other way still
  // cannot put script in front of the reader.
  const html = client.sopContent
    ? sanitizeDocumentationHtml(client.sopContent)
    : "";

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <BackLink href="/clients">
          Back to Clients
        </BackLink>

        <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium uppercase tracking-normal text-slate-500">
                SOP
              </p>
              <h1 className="mt-2 break-words text-2xl font-semibold tracking-normal text-slate-950">
                {client.name}
              </h1>
            </div>
            <Link
              href={`/clients/${client.id}/edit`}
              className="inline-flex shrink-0 items-center justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Edit
            </Link>
          </header>

          {html ? (
            <div
              className="ck-content doc-content mt-6"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <p className="mt-6 text-sm text-slate-400">
              No SOP has been written for this client yet.
            </p>
          )}

          {client.sop ? (
            <section className="mt-8 border-t border-slate-200 pt-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                File
              </h2>
              <p className="mt-3 text-sm">
                <a
                  href={`/api/clients/${client.id}/sop`}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all font-medium text-[#770FC2] hover:underline"
                >
                  {client.sop.fileName}
                </a>
                <span className="ml-2 text-xs text-slate-500">
                  {formatFileSize(client.sop.size)}
                </span>
              </p>
            </section>
          ) : null}
        </article>
      </div>
    </DashboardLayout>
  );
}
