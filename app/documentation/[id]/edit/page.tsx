import BackLink from "@/components/ui/BackLink";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DocumentationForm from "@/components/documentation/DocumentationForm";
import { updateDocumentation } from "@/app/documentation/actions";
import { canManageDocumentation } from "@/lib/documentation";

type EditDocumentationPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditDocumentationPage({
  params,
}: EditDocumentationPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const sessionUser = session.user as typeof session.user & {
    id?: string;
    role?: string;
  };

  const { id } = await params;
  const doc = await prisma.documentation.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      content: true,
      createdById: true,
    },
  });

  if (!doc) {
    notFound();
  }

  if (!canManageDocumentation(sessionUser, doc)) {
    redirect(`/documentation/${id}`);
  }

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header>
          <BackLink href={`/documentation/${doc.id}`}>Back to Page</BackLink>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
            Edit Page
          </h1>
        </header>

        <DocumentationForm
          action={updateDocumentation}
          submitLabel="Save Changes"
          pendingLabel="Saving..."
          cancelHref={`/documentation/${doc.id}`}
          page={{
            id: doc.id,
            title: doc.title,
            content: doc.content,
          }}
        />
      </div>
    </DashboardLayout>
  );
}
