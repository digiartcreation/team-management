import FormPageHeader from "@/components/ui/FormPageHeader";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import LearningForm from "@/components/learnings/LearningForm";
import { updateLearning } from "@/app/learnings/actions";

type EditLearningPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditLearningPage({
  params,
}: EditLearningPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const sessionUser = session.user as typeof session.user & { id?: string };
  const { id } = await params;
  const learning = await prisma.learning.findUnique({ where: { id } });

  if (!learning) {
    notFound();
  }

  if (learning.userId !== sessionUser.id) {
    redirect("/learnings");
  }

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <FormPageHeader
          backHref="/learnings"
          backLabel="Back to Learnings"
          title="Edit Learning"
          description="Update what you learned or where to find it."
        />
        <LearningForm
          action={updateLearning}
          submitLabel="Update Learning"
          learning={learning}
        />
      </div>
    </DashboardLayout>
  );
}
