import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ClientForm from "@/components/clients/ClientForm";
import { updateClient } from "@/app/clients/actions";
import {
  seedMappingsFromLegacy,
  toServiceMappings,
} from "@/lib/clientServices";

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
      serviceMappings: {
        orderBy: { service: "asc" },
        select: {
          service: true,
          focus: true,
          paymentType: true,
          percentage: true,
          packageAmount: true,
          billingCycle: true,
        },
      },
    },
  });

  if (!client) {
    notFound();
  }

  // Clients created before payment mapping existed have no rows yet; seed the
  // form from the legacy services text so their services are not lost.
  const serviceMappings =
    client.serviceMappings.length > 0
      ? toServiceMappings(client.serviceMappings)
      : seedMappingsFromLegacy(client.services);

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
          client={{ ...client, serviceMappings }}
        />
      </div>
    </DashboardLayout>
  );
}
