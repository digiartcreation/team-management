import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ToolUsageForm from "@/components/tools/ToolUsageForm";
import FormPageHeader from "@/components/ui/FormPageHeader";
import { updateToolUsage } from "@/app/tools/actions";

type EditToolPageProps = { params: Promise<{ id: string }> };

export default async function EditToolPage({ params }: EditToolPageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const sessionUser = session.user as typeof session.user & { id?: string };
  const { id } = await params;
  const entry = await prisma.toolUsage.findUnique({ where: { id } });
  if (!entry) notFound();
  if (entry.userId !== sessionUser.id) redirect("/tools");

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <FormPageHeader
          backHref="/tools"
          backLabel="Back to AI Tools"
          title="Edit Tool Usage"
          description="Update this entry's details."
        />
        <ToolUsageForm action={updateToolUsage} submitLabel="Update Entry" entry={entry} />
      </div>
    </DashboardLayout>
  );
}
