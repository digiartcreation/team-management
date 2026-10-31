import BackLink from "@/components/ui/BackLink";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ResearchDocumentForm from "@/components/research/ResearchDocumentForm";
import { updateResearchDocument } from "@/app/research/actions";

type EditResearchPageProps = { params: Promise<{ id: string }> };

export default async function EditResearchPage({ params }: EditResearchPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const sessionUser = session.user as typeof session.user & { id?: string };
  const { id } = await params;
  const document = await prisma.researchDocument.findUnique({ where: { id } });
  if (!document) notFound();
  if (document.userId !== sessionUser.id) redirect("/research");
  return <DashboardLayout><div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><header><BackLink href="/research">Back to Research</BackLink><h1 className="mt-3 text-2xl font-semibold text-slate-950">Edit Research Document</h1></header><ResearchDocumentForm action={updateResearchDocument} submitLabel="Update Document" document={document} /></div></DashboardLayout>;
}
