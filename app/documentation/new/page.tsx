import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DocumentationForm from "@/components/documentation/DocumentationForm";
import { createDocumentation } from "@/app/documentation/actions";

export default async function NewDocumentationPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header>
          <Link
            href="/documentation"
            className="text-sm font-medium text-slate-500 transition hover:text-slate-950"
          >
            Back to Documentation
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
            New Page
          </h1>
        </header>

        <DocumentationForm
          action={createDocumentation}
          submitLabel="Publish Page"
          pendingLabel="Publishing..."
          cancelHref="/documentation"
        />
      </div>
    </DashboardLayout>
  );
}
