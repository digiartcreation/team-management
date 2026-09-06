import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ClientForm from "@/components/clients/ClientForm";
import { updateClient } from "@/app/clients/actions";

type EditClientPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditClientPage({ params }: EditClientPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const sessionUser = session.user as typeof session.user & {
    role?: string;
  };

  if (sessionUser.role !== "admin") {
    redirect("/");
  }

  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      contactPerson: true,
      email: true,
      phone: true,
      services: true,
      status: true,
      notes: true,
    },
  });

  if (!client) {
    notFound();
  }

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header>
          <Link
            href="/clients"
            className="text-sm font-medium text-slate-500 transition hover:text-slate-950"
          >
            Back to Clients
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
            Edit Client
          </h1>
        </header>

        <ClientForm
          action={updateClient}
          submitLabel="Update Client"
          client={client}
        />
      </div>
    </DashboardLayout>
  );
}
