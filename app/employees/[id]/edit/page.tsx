import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DashboardLayout from "@/components/layout/DashboardLayout";
import EmployeeForm from "@/components/employees/EmployeeForm";
import { updateEmployee } from "@/app/employees/actions";

type EditEmployeePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditEmployeePage({
  params,
}: EditEmployeePageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const sessionUser = session.user as typeof session.user & {
    role?: string;
    isSuperAdmin?: boolean;
  };

  // Admins can view employees; only a super admin edits them.
  if (!sessionUser.isSuperAdmin) {
    redirect("/employees");
  }

  const { id } = await params;

  const employee = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      sector: true,
      designation: true,
    },
  });

  if (!employee) {
    notFound();
  }

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header>
          <Link
            href="/employees"
            className="text-sm font-medium text-slate-500 transition hover:text-slate-950"
          >
            Back to Employees
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
            Edit Employee
          </h1>
        </header>

        <EmployeeForm
          action={updateEmployee}
          submitLabel="Update Employee"
          employee={employee}
          canAssignSuperAdmin={sessionUser.isSuperAdmin === true}
        />
      </div>
    </DashboardLayout>
  );
}
