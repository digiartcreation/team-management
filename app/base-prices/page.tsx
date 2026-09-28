import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ActionMenu from "@/components/ui/ActionMenu";
import DeleteMenuAction from "@/components/ui/DeleteMenuAction";
import { deleteBasePrice } from "@/app/base-prices/actions";
import { DESIGNATION_OPTIONS } from "@/lib/designations";
import { SERVICE_OPTIONS, formatInr } from "@/lib/services";

/** Orders rows the way the dropdowns list them, not alphabetically. */
function rank(options: string[], value: string) {
  const index = options.indexOf(value);
  return index === -1 ? options.length : index;
}

export default async function BasePricesPage() {
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

  const basePrices = (
    await prisma.basePrice.findMany({
      select: {
        id: true,
        service: true,
        designation: true,
        basePrice: true,
      },
    })
  ).sort(
    (a, b) =>
      rank(SERVICE_OPTIONS, a.service) - rank(SERVICE_OPTIONS, b.service) ||
      rank(DESIGNATION_OPTIONS, a.designation) -
        rank(DESIGNATION_OPTIONS, b.designation)
  );

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-normal text-slate-500">
              Base Price
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
              Base Price Management
            </h1>
          </div>
          <Link
            href="/base-prices/new"
            className="inline-flex items-center justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Set Base Price
          </Link>
        </header>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {basePrices.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-slate-700">
                No base prices set.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Choose a service and designation to set its hourly base price.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-normal text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Service</th>
                    <th className="px-4 py-3 font-semibold">Hourly</th>
                    <th className="px-4 py-3 font-semibold">Designation</th>
                    <th className="px-4 py-3 font-semibold">Base Price</th>
                    <th className="px-4 py-3 font-semibold">
                      <span className="sr-only">Row menu</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {basePrices.map((basePrice) => (
                      <tr key={basePrice.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4 font-medium text-slate-950">
                          {basePrice.service}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          Per hour
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {basePrice.designation}
                        </td>
                        <td className="px-4 py-4 font-medium text-[#770FC2]">
                          {formatInr(basePrice.basePrice.toNumber())} / hour
                        </td>
                        <td className="px-4 py-4">
                          <ActionMenu>
                            <Link
                              href={`/base-prices/${basePrice.id}/edit`}
                              className="rounded px-3 py-2 text-sm text-[#1F2937] transition hover:bg-[#F3E8FF] hover:text-[#770FC2]"
                            >
                              Edit
                            </Link>
                            <DeleteMenuAction
                              id={basePrice.id}
                              action={deleteBasePrice}
                              message="Are you sure you want to delete this base price?"
                            />
                          </ActionMenu>
                        </td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
