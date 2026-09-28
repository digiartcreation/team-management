import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import BasePriceForm from "@/components/basePrices/BasePriceForm";
import { createBasePrice } from "@/app/base-prices/actions";

export default async function NewBasePricePage() {
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
            Set Base Price
          </h1>
        </header>

        <BasePriceForm action={createBasePrice} submitLabel="Save Base Price" />
      </div>
    </DashboardLayout>
  );
}
