import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DeleteEmployeeButton from "@/components/employees/DeleteEmployeeButton";
import ResetPasswordButton from "@/components/employees/ResetPasswordButton";
import ActionMenu from "@/components/ui/ActionMenu";
import { MobileCard, MobileCardList, MobileField } from "@/components/ui/MobileCard";
import PaginationControls from "@/components/layout/PaginationControls";
import { getPage, getPagination, PAGE_SIZE } from "@/lib/pagination";
import { SUPER_ADMIN, formatRole } from "@/lib/roles";

const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

type EmployeesPageProps = {
  searchParams: Promise<{ page?: string; status?: string }>;
};

function StatusPill({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
        isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-200 text-gray-600"
      }`}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function RolePill({ role }: { role: string }) {
  return (
    <span className="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
      {formatRole(role)}
    </span>
  );
}

export default async function EmployeesPage({ searchParams }: EmployeesPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const sessionUser = session.user as typeof session.user & {
    id?: string;
    role?: string;
    isSuperAdmin?: boolean;
  };
  // Admins see the list and can reset passwords; only a super admin adds,
  // edits or deletes.
  if (sessionUser.role !== "admin") {
    redirect("/");
  }

  const isSuperAdmin = sessionUser.isSuperAdmin === true;

  const params = await searchParams;
  const page = getPage(params.page);
  const status =
    params.status === "active" || params.status === "inactive" ? params.status : "";
  const where = status ? { isActive: status === "active" } : {};
  const [employees, totalEmployees, activeCount, inactiveCount] = await Promise.all([
    prisma.user.findMany({
      where,
      ...getPagination(page),
      // Active people first, newest first within each.
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        sector: true,
        designation: true,
        isActive: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: false } }),
  ]);
  const counts = {
    "": activeCount + inactiveCount,
    active: activeCount,
    inactive: inactiveCount,
  };

  type EmployeeRow = (typeof employees)[number];

  // A password can be reset for anyone but yourself (that is My Profile), and
  // a super admin's only by another super admin.
  const canReset = (employee: EmployeeRow) =>
    employee.id !== sessionUser.id && (isSuperAdmin || employee.role !== SUPER_ADMIN);

  // A ⋯ menu in the table, a labelled one on a phone card; null when there is
  // nothing the viewer may do to the row.
  const rowMenu = (employee: EmployeeRow, trigger?: string) =>
    isSuperAdmin || canReset(employee) ? (
      <ActionMenu trigger={trigger}>
        {isSuperAdmin ? (
          <Link
            href={`/employees/${employee.id}/edit`}
            className="rounded px-3 py-2 text-sm text-[#1F2937] transition hover:bg-[#F3E8FF] hover:text-[#770FC2]"
          >
            Edit
          </Link>
        ) : null}
        {canReset(employee) ? (
          <ResetPasswordButton employeeId={employee.id} employeeName={employee.name} />
        ) : null}
        {isSuperAdmin ? <DeleteEmployeeButton employeeId={employee.id} /> : null}
      </ActionMenu>
    ) : null;

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-normal text-slate-500">
              Employees
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
              Employee Management
            </h1>
          </div>
          {isSuperAdmin ? (
            <Link
              href="/employees/new"
              className="inline-flex items-center justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Add Employee
            </Link>
          ) : null}
        </header>

        {/* Plain links, a full page load: in production a client-side hop
            that only changes the query string sometimes never finishes. */}
        <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => {
            const selected = status === filter.value;

            return (
              <a
                key={filter.value || "all"}
                href={filter.value ? `/employees?status=${filter.value}` : "/employees"}
                aria-current={selected ? "page" : undefined}
                className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition ${
                  selected
                    ? "bg-[#770FC2] text-white ring-[#770FC2]"
                    : "bg-white text-slate-700 ring-slate-200 hover:ring-[#A05DD0]"
                }`}
              >
                {filter.label}
                <span
                  className={`rounded-full px-1.5 text-xs ${
                    selected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {counts[filter.value]}
                </span>
              </a>
            );
          })}
        </nav>

        {/* Phones get cards, the list below; the table is for wider screens. */}
        <section
          className={`overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ${
            employees.length > 0 ? "hidden md:block" : ""
          }`}
        >
          {employees.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-slate-700">
                No employees found.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {status
                  ? `No ${status} employees.`
                  : "Employees will appear here after they are created."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-normal text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Domain</th>
                    <th className="px-4 py-3 font-semibold">Designation</th>
                    <th className="px-4 py-3 font-semibold">Created Date</th>
                    <th className="px-4 py-3 font-semibold">
                      <span className="sr-only">Row menu</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {employees.map((employee) => (
                    <tr
                      key={employee.id}
                      className={`hover:bg-slate-50 ${employee.isActive ? "" : "opacity-70"}`}
                    >
                      <td className="px-4 py-4 font-medium text-slate-950">
                        {employee.name}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {employee.email}
                      </td>
                      <td className="px-4 py-4">
                        <RolePill role={employee.role} />
                      </td>
                      <td className="px-4 py-4">
                        <StatusPill isActive={employee.isActive} />
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {employee.sector ?? (
                          <span className="text-slate-400">Not set</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {employee.designation ?? (
                          <span className="text-slate-400">Not set</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {dateFormatter.format(employee.createdAt)}
                      </td>
                      <td className="px-4 py-4">
                        {rowMenu(employee) ?? (
                          <span className="text-sm text-slate-400">
                            View only
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {employees.length > 0 ? (
          <MobileCardList>
            {employees.map((employee) => (
              <MobileCard
                key={employee.id}
                title={employee.name}
                subtitle={employee.email}
                status={
                  employee.isActive ? (
                    <RolePill role={employee.role} />
                  ) : (
                    <StatusPill isActive={false} />
                  )
                }
                actions={rowMenu(employee, "Actions")}
              >
                {/* The line under the name cuts a long address short. */}
                <MobileField label="Email">
                  <span className="break-all">{employee.email}</span>
                </MobileField>
                <div className="grid grid-cols-2 gap-3">
                  <MobileField label="Role">{formatRole(employee.role)}</MobileField>
                  <MobileField label="Status">
                    <StatusPill isActive={employee.isActive} />
                  </MobileField>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MobileField label="Domain">
                    {employee.sector ?? <span className="text-slate-400">Not set</span>}
                  </MobileField>
                  <MobileField label="Designation">
                    {employee.designation ?? (
                      <span className="text-slate-400">Not set</span>
                    )}
                  </MobileField>
                </div>
                <MobileField label="Created Date">
                  {dateFormatter.format(employee.createdAt)}
                </MobileField>
              </MobileCard>
            ))}
          </MobileCardList>
        ) : null}
        <PaginationControls
          page={page}
          total={totalEmployees}
          pageSize={PAGE_SIZE}
          basePath="/employees"
          searchParams={params}
        />
      </div>
    </DashboardLayout>
  );
}
