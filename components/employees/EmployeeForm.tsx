"use client";

import { useActionState, useTransition } from "react";
import SectorDesignationField from "@/components/employees/SectorDesignationField";
import type { EmployeeFormState } from "@/app/employees/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwords";
import { SUPER_ADMIN, formatRole } from "@/lib/roles";

type EmployeeFormProps = {
  action: (
    previous: EmployeeFormState,
    formData: FormData
  ) => Promise<EmployeeFormState>;
  submitLabel: string;
  employee?: {
    id: string;
    name: string;
    email: string;
    role: string;
    sector: string | null;
    designation: string | null;
    isActive: boolean;
  };
  includePassword?: boolean;
  /** Only a super admin may hand out the Super Admin role. */
  canAssignSuperAdmin?: boolean;
};

const baseRoles = ["admin", "manager", "member"];

const fieldClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

export default function EmployeeForm({
  action,
  submitLabel,
  employee,
  includePassword = false,
  canAssignSuperAdmin = false,
}: EmployeeFormProps) {
  const roles = canAssignSuperAdmin ? [SUPER_ADMIN, ...baseRoles] : baseRoles;
  const [state, formAction, isPending] = useActionState(action, null);
  const [, startSubmit] = useTransition();

  return (
    <form
      onSubmit={(event) => {
        // Sent by hand rather than through `action`, after which React
        // clears the form: an email already in use would wipe out everything
        // typed along with it.
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startSubmit(() => formAction(formData));
      }}
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
            className={fieldClass}
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            name="email"
            type="email"
            defaultValue={employee?.email}
            required
            className={fieldClass}
          />
          <span className="text-xs text-slate-500">
            One account per email address.
          </span>
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
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              className={fieldClass}
            />
            <span className="text-xs text-slate-500">
              At least {MIN_PASSWORD_LENGTH} characters. They can change it on
              My Profile.
            </span>
          </label>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Role</span>
            <select
              name="role"
              defaultValue={employee?.role ?? "member"}
              required
              className={`${fieldClass} capitalize`}
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {formatRole(role)}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select
              name="status"
              defaultValue={employee?.isActive === false ? "inactive" : "active"}
              className={fieldClass}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
        <p className="-mt-3 text-xs text-slate-500">
          An inactive employee cannot sign in and is not offered when tasks,
          watchers or teams are picked. Their past work stays.
        </p>

        <SectorDesignationField
          selectedSector={employee?.sector ?? null}
          selectedDesignation={employee?.designation ?? null}
        />
      </div>

      {state && "error" in state ? (
        <p
          role="alert"
          className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.error}
        </p>
      ) : null}

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {isPending ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
