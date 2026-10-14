import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import BasePriceForm from "@/components/basePrices/BasePriceForm";
import { updateBasePrice } from "@/app/base-prices/actions";

type EditBasePricePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditBasePricePage({
  params,
}: EditBasePricePageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const sessionUser = session.user as typeof session.user & {
    isSuperAdmin?: boolean;
  };

  if (!sessionUser.isSuperAdmin) {
    redirect("/");
  }

  const { id } = await params;

  const basePrice = await prisma.basePrice.findUnique({
    where: { id },
    select: {
      id: true,
      service: true,
      designation: true,
      basePrice: true,
    },
  });

  if (!basePrice) {
    notFound();
  }

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header>
          <Link
            href="/base-prices"
            className="text-sm font-medium text-slate-500 transition hover:text-slate-950"
          >
            Back to Base Price
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
            Edit Base Price
          </h1>
        </header>

        <BasePriceForm
          action={updateBasePrice}
          submitLabel="Update Base Price"
          basePrice={{
            ...basePrice,
            basePrice: basePrice.basePrice.toNumber(),
          }}
        />
      </div>
    </DashboardLayout>
  );
}
