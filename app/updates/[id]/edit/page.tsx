import FormPageHeader from "@/components/ui/FormPageHeader";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DailyUpdateForm from "@/components/updates/DailyUpdateForm";
import { updateDailyUpdate } from "@/app/updates/actions";

type EditUpdatePageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditUpdatePage({ params }: EditUpdatePageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const sessionUser = session.user as typeof session.user & { id?: string };
  const { id } = await params;
  const update = await prisma.dailyUpdate.findUnique({ where: { id } });

  if (!update) {
    notFound();
  }

  if (update.userId !== sessionUser.id) {
    redirect("/updates");
  }

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <FormPageHeader
          backHref="/updates"
          backLabel="Back to Updates"
          title="Edit Daily Update"
          description="Correct or add to this day’s update."
        />
        <DailyUpdateForm
          action={updateDailyUpdate}
          submitLabel="Update"
          update={update}
        />
      </div>
    </DashboardLayout>
  );
}
