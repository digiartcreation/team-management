import FormPageHeader from "@/components/ui/FormPageHeader";
import { redirect } from "next/navigation";
import { getShellSession, preloadShell } from "@/lib/shell";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DailyUpdateForm from "@/components/updates/DailyUpdateForm";
import { createDailyUpdate } from "@/app/updates/actions";

export default async function NewUpdatePage() {
  const session = await getShellSession();

  if (!session?.user) {
    redirect("/login");
  }

  preloadShell(session);

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <FormPageHeader
          backHref="/updates"
          backLabel="Back to Updates"
          title="Add Daily Update"
          description="Record what you worked on today."
        />
        <DailyUpdateForm
          action={createDailyUpdate}
          submitLabel="Create Update"
        />
      </div>
    </DashboardLayout>
  );
}
