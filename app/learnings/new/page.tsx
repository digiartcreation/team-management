import FormPageHeader from "@/components/ui/FormPageHeader";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import LearningForm from "@/components/learnings/LearningForm";
import { createLearning } from "@/app/learnings/actions";

export default async function NewLearningPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <FormPageHeader
          backHref="/learnings"
          backLabel="Back to Learnings"
          title="Add Learning"
          description="Share something you learned so the team can find it later."
        />
        <LearningForm action={createLearning} submitLabel="Create Learning" />
      </div>
    </DashboardLayout>
  );
}
