export const SUPER_ADMIN = "superadmin";

/**
 * A super admin can do everything an admin can, plus manage base prices. The
 * session carries role "admin" for them (see auth.ts) so every admin check in
 * the app keeps working, and flags the extra access with isSuperAdmin.
 */
export function isSuperAdminRole(role?: string | null) {
  return role === SUPER_ADMIN;
}

/** Roles that receive admin notifications and count as admins in queries. */
export const ADMIN_ROLES = ["admin", SUPER_ADMIN];

export function formatRole(role: string) {
  if (role === SUPER_ADMIN) return "Super Admin";
  if (role === "member") return "Employee";
  return role.charAt(0).toUpperCase() + role.slice(1);
}
