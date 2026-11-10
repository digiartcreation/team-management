import Link from "next/link";
import { redirect } from "next/navigation";
import { getShellSession, preloadShell } from "@/lib/shell";
import DashboardLayout from "@/components/layout/DashboardLayout";
import FeedbackForm from "@/components/feedback/FeedbackForm";

export default async function ReportIssuePage() {
  const session = await getShellSession();
  if (!session?.user) redirect("/login");
  preloadShell(session);

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header>
          <Link href="/feedback/submissions" className="text-sm font-medium text-slate-500">
            My Submissions
          </Link>
          <p className="mt-4 text-sm font-medium uppercase text-slate-500">
            Feedback Center
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">
            Report an Issue
          </h1>
        </header>
        <FeedbackForm type="Issue Report" />
      </div>
    </DashboardLayout>
  );
}
