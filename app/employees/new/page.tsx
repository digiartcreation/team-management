import { redirect } from "next/navigation";
import BackLink from "@/components/ui/BackLink";
import { auth } from "@/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import EmployeeForm from "@/components/employees/EmployeeForm";
import { createEmployee } from "@/app/employees/actions";

export default async function NewEmployeePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const sessionUser = session.user as typeof session.user & {
    role?: string;
    isSuperAdmin?: boolean;
  };

  // Admins can view employees; only a super admin adds them.
  if (!sessionUser.isSuperAdmin) {
    redirect("/employees");
  }

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header>
          <BackLink href="/employees">
            Back to Employees
          </BackLink>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
            Add Employee
          </h1>
        </header>

        <EmployeeForm
          action={createEmployee}
          submitLabel="Create Employee"
          includePassword
          canAssignSuperAdmin={sessionUser.isSuperAdmin === true}
        />
      </div>
    </DashboardLayout>
  );
}
