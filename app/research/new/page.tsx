import BackLink from "@/components/ui/BackLink";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ResearchDocumentForm from "@/components/research/ResearchDocumentForm";
import { createResearchDocument } from "@/app/research/actions";

export default async function NewResearchPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <DashboardLayout><div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><header><BackLink href="/research">Back to Research</BackLink><h1 className="mt-3 text-2xl font-semibold text-slate-950">Add Research Document</h1></header><ResearchDocumentForm action={createResearchDocument} submitLabel="Create Document" /></div></DashboardLayout>;
}
