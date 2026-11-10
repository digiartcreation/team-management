import { redirect } from "next/navigation";
import { getShellSession, preloadShell } from "@/lib/shell";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ToolUsageForm from "@/components/tools/ToolUsageForm";
import FormPageHeader from "@/components/ui/FormPageHeader";
import { createToolUsage } from "@/app/tools/actions";

export default async function NewToolPage() {
  const session = await getShellSession();
  if (!session?.user) redirect("/login");
  preloadShell(session);

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <FormPageHeader
          backHref="/tools"
          backLabel="Back to AI Tools"
          title="Add Tool Usage"
          description="Record an AI or automation tool you used and what it did for the work."
        />
        <ToolUsageForm action={createToolUsage} submitLabel="Create Entry" />
      </div>
    </DashboardLayout>
  );
}
