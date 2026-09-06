import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PaginationControls from "@/components/layout/PaginationControls";
import { getPage, getPagination, PAGE_SIZE } from "@/lib/pagination";
import ActionMenu from "@/components/ui/ActionMenu";
import DeleteMenuAction from "@/components/ui/DeleteMenuAction";
import { deleteClient } from "@/app/clients/actions";
import { CLIENT_STATUS_OPTIONS, parseServices } from "@/lib/services";

const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

type ClientsPageProps = {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
};

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
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

  const params = await searchParams;
  const page = getPage(params.page);
  const q = params.q?.trim();
  const status = params.status?.trim();

  const where: Prisma.ClientWhereInput = {};

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { contactPerson: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
    ];
  }

  if (status && CLIENT_STATUS_OPTIONS.includes(status)) {
    where.status = status;
  }

  const [clients, totalClients] = await Promise.all([
    prisma.client.findMany({
      where,
      ...getPagination(page),
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.client.count({ where }),
  ]);

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-normal text-slate-500">
              Client Management
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
              Clients
            </h1>
          </div>
          <Link
            href="/clients/new"
            className="inline-flex items-center justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Add Client
          </Link>
        </header>

        <form className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_220px_auto_auto]">
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search by name, contact, email or phone"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            name="status"
            defaultValue={params.status ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {CLIENT_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white">
            Filter
          </button>
          <Link
            href="/clients"
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Reset
          </Link>
        </form>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {clients.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-slate-700">
                No clients found.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Clients will appear here after they are created.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-normal text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Client Name</th>
                    <th className="px-4 py-3 font-semibold">Contact</th>
                    <th className="px-4 py-3 font-semibold">Services</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Created On</th>
                    <th className="px-4 py-3 font-semibold">
                      <span className="sr-only">Row menu</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {clients.map((client) => {
                    const services = parseServices(client.services);

                    return (
                      <tr key={client.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4 font-medium text-slate-950">
                          {client.name}
                          {client.notes ? (
                            <div className="mt-1 whitespace-pre-line break-words text-xs text-slate-500">
                              {client.notes}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          <div>
                            {client.contactPerson || "No contact person"}
                          </div>
                          {client.email ? (
                            <div className="mt-1 text-xs text-slate-500">
                              {client.email}
                            </div>
                          ) : null}
                          {client.phone ? (
                            <div className="mt-1 text-xs text-slate-500">
                              {client.phone}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {services.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {services.map((service) => (
                                <span
                                  key={service}
                                  className="rounded-full bg-[#F3E8FF] px-2 py-0.5 text-xs text-[#770FC2]"
                                >
                                  {service}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">
                              No services assigned
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              client.status === "Active"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {client.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          <div>{dateFormatter.format(client.createdAt)}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            by {client.createdBy.name}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <ActionMenu>
                            <Link
                              href={`/clients/${client.id}/edit`}
                              className="rounded px-3 py-2 text-sm text-[#1F2937] transition hover:bg-[#F3E8FF] hover:text-[#770FC2]"
                            >
                              Edit
                            </Link>
                            <DeleteMenuAction
                              id={client.id}
                              action={deleteClient}
                              message="Are you sure you want to delete this client?"
                            />
                          </ActionMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <PaginationControls
          page={page}
          total={totalClients}
          pageSize={PAGE_SIZE}
          basePath="/clients"
          searchParams={params}
        />
      </div>
    </DashboardLayout>
  );
}
