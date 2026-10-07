import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DeleteEmployeeButton from "@/components/employees/DeleteEmployeeButton";
import ActionMenu from "@/components/ui/ActionMenu";
import PaginationControls from "@/components/layout/PaginationControls";
import { getPage, getPagination, PAGE_SIZE } from "@/lib/pagination";
import { formatRole, isSuperAdminRole } from "@/lib/roles";

const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

type EmployeesPageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function EmployeesPage({ searchParams }: EmployeesPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const sessionUser = session.user as typeof session.user & {
    role?: string;
    isSuperAdmin?: boolean;
  };
  const isAdmin = sessionUser.role === "admin";

  const params = await searchParams;
  const page = getPage(params.page);
  const [employees, totalEmployees] = await Promise.all([
    prisma.user.findMany({
      ...getPagination(page),
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        designation: true,
        createdAt: true,
      },
    }),
    prisma.user.count(),
  ]);

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
          {isAdmin ? (
            <Link
              href="/employees/new"
              className="inline-flex items-center justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Add Employee
            </Link>
          ) : null}
        </header>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {employees.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-slate-700">
                No employees found.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Employees will appear here after they are created.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-normal text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Designation</th>
                    <th className="px-4 py-3 font-semibold">Created Date</th>
                    <th className="px-4 py-3 font-semibold">
                      <span className="sr-only">Row menu</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {employees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4 font-medium text-slate-950">
                        {employee.name}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {employee.email}
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
                          {formatRole(employee.role)}
                        </span>
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
                        {isAdmin &&
                        (sessionUser.isSuperAdmin ||
                          !isSuperAdminRole(employee.role)) ? (
                          <ActionMenu>
                            <Link
                              href={`/employees/${employee.id}/edit`}
                              className="rounded px-3 py-2 text-sm text-[#1F2937] transition hover:bg-[#F3E8FF] hover:text-[#770FC2]"
                            >
                              Edit
                            </Link>
                            <DeleteEmployeeButton employeeId={employee.id} />
                          </ActionMenu>
                        ) : (
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
