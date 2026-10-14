import SectorDesignationField from "@/components/employees/SectorDesignationField";
import { SUPER_ADMIN, formatRole } from "@/lib/roles";

type EmployeeFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  employee?: {
    id: string;
    name: string;
    email: string;
    role: string;
    sector: string | null;
    designation: string | null;
  };
  includePassword?: boolean;
  /** Only a super admin may hand out the Super Admin role. */
  canAssignSuperAdmin?: boolean;
};

const baseRoles = ["admin", "manager", "member"];

export default function EmployeeForm({
  action,
  submitLabel,
  employee,
  includePassword = false,
  canAssignSuperAdmin = false,
}: EmployeeFormProps) {
  const roles = canAssignSuperAdmin ? [SUPER_ADMIN, ...baseRoles] : baseRoles;

  return (
    <form
      action={action}
      className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      {employee ? <input type="hidden" name="id" value={employee.id} /> : null}

      <div className="grid gap-5">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Name</span>
          <input
            name="name"
            type="text"
            defaultValue={employee?.name}
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            name="email"
            type="email"
            defaultValue={employee?.email}
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
        </label>

        {includePassword ? (
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">
              Password
            </span>
            <input
              name="password"
              type="password"
              required
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />
          </label>
        ) : null}

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Role</span>
          <select
            name="role"
            defaultValue={employee?.role ?? "member"}
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm capitalize outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          >
              {roles.map((role) => (
                <option key={role} value={role}>
                {formatRole(role)}
                </option>
              ))}
          </select>
        </label>

        <SectorDesignationField
          selectedSector={employee?.sector ?? null}
          selectedDesignation={employee?.designation ?? null}
        />
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
