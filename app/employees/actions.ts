"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { CALENDAR_TAG } from "@/lib/calendarEvents";
import { FILTER_TAGS } from "@/lib/filterOptions";
import {
  isDesignation,
  isDesignationInSector,
  isSector,
} from "@/lib/designations";
import { passwordError } from "@/lib/passwords";
import { SUPER_ADMIN } from "@/lib/roles";

const roles = new Set([SUPER_ADMIN, "admin", "manager", "member"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Returned to the employee form instead of thrown, so a rejected save shows
 * a message above the button and keeps what was typed, rather than swapping
 * the page for the error screen.
 */
export type EmployeeFormState = { error: string } | null;

/** Returned to the reset password dialog. */
export type ResetPasswordState = { ok: true } | { error: string } | null;

type SessionUser = {
  id?: string;
  role?: string;
  isSuperAdmin?: boolean;
};

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function currentUser() {
  const session = await auth();
  return session?.user as SessionUser | undefined;
}

/** Adding, editing and deleting employees is for super admins; admins only view. */
async function requireSuperAdmin() {
  const sessionUser = await currentUser();

  if (!sessionUser?.isSuperAdmin) {
    redirect("/employees");
  }

  return sessionUser as SessionUser & { id: string };
}

/** The sector and designation chosen, or the reason they cannot be saved. */
function resolveSectorAndDesignation(formData: FormData) {
  const sector = getValue(formData, "sector") || null;
  const designation = getValue(formData, "designation") || null;

  if (sector && !isSector(sector)) {
    return { error: "Invalid domain." };
  }

  if (designation) {
    if (!isDesignation(designation)) {
      return { error: "Invalid designation." };
    }

    if (!isDesignationInSector(designation, sector ?? "")) {
      return {
        error: sector
          ? `${designation} is not a designation in ${sector}.`
          : "Choose a domain for this designation.",
      };
    }
  }

  return { sector, designation };
}

/**
 * Whether another account already has this email. Emails are stored
 * lowercased, and the database's unique index (once the migration's last step
 * runs) backs this up.
 */
async function emailTaken(email: string, exceptId?: string) {
  const other = await prisma.user.findFirst({
    where: { email, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });

  return Boolean(other);
}

const EMAIL_TAKEN = "Another employee already uses this email. Each email can only belong to one account.";

function prismaEmployeeError(error: unknown): EmployeeFormState {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return { error: EMAIL_TAKEN };
    }

    if (error.code === "P2025") {
      return { error: "Employee not found." };
    }
  }

  throw error;
}

export async function createEmployee(
  _previous: EmployeeFormState,
  formData: FormData
): Promise<EmployeeFormState> {
  const sessionUser = await requireSuperAdmin();

  const name = getValue(formData, "name");
  const email = getValue(formData, "email").toLowerCase();
  const password = getValue(formData, "password");
  const role = getValue(formData, "role");
  const isActive = getValue(formData, "status") !== "inactive";

  if (!name || !email || !password || !roles.has(role)) {
    return { error: "Fill in the name, email, password and role." };
  }

  const placement = resolveSectorAndDesignation(formData);

  if (placement.error) {
    return { error: placement.error };
  }

  if (!emailPattern.test(email)) {
    return { error: "Enter a valid email address." };
  }

  const weakPassword = passwordError(password);

  if (weakPassword) {
    return { error: weakPassword };
  }

  if (await emailTaken(email)) {
    return { error: EMAIL_TAKEN };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const employee = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        sector: placement.sector,
        designation: placement.designation,
        isActive,
      },
      select: { id: true },
    });
    await logActivity({
      userId: sessionUser.id,
      action: "created",
      entityType: "employee",
      entityId: employee.id,
      description: `Created employee ${name}`,
    });
  } catch (error) {
    return prismaEmployeeError(error);
  }

  // The Employee filters (lib/filterOptions.ts).
  revalidateTag(FILTER_TAGS.people);
  revalidatePath("/employees");
  redirect("/employees");
}

export async function updateEmployee(
  _previous: EmployeeFormState,
  formData: FormData
): Promise<EmployeeFormState> {
  const sessionUser = await requireSuperAdmin();

  const id = getValue(formData, "id");
  const name = getValue(formData, "name");
  const email = getValue(formData, "email").toLowerCase();
  const role = getValue(formData, "role");
  const isActive = getValue(formData, "status") !== "inactive";

  if (!id || !name || !email || !roles.has(role)) {
    return { error: "Fill in the name, email and role." };
  }

  // Turning yourself off would lock you out on the next sign-in.
  if (id === sessionUser.id && !isActive) {
    return { error: "You cannot make your own account inactive." };
  }

  const placement = resolveSectorAndDesignation(formData);

  if (placement.error) {
    return { error: placement.error };
  }

  if (!emailPattern.test(email)) {
    return { error: "Enter a valid email address." };
  }

  if (await emailTaken(email, id)) {
    return { error: EMAIL_TAKEN };
  }

  try {
    const before = await prisma.user.findUniqueOrThrow({
      where: { id },
      select: { isActive: true },
    });

    await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        role,
        sector: placement.sector,
        designation: placement.designation,
        isActive,
      },
    });

    if (before.isActive !== isActive) {
      await logActivity({
        userId: sessionUser.id,
        action: "updated",
        entityType: "employee",
        entityId: id,
        description: `Marked employee ${name} ${isActive ? "active" : "inactive"}`,
      });
    }
  } catch (error) {
    return prismaEmployeeError(error);
  }

  // The Employee filters show the name and list active people only
  // (lib/filterOptions.ts).
  revalidateTag(FILTER_TAGS.people);
  revalidatePath("/employees");
  redirect("/employees");
}

export async function deleteEmployee(id: string) {
  const sessionUser = await requireSuperAdmin();

  if (sessionUser.id === id) {
    throw new Error("You cannot delete your own account.");
  }

  try {
    await prisma.user.delete({
      where: { id },
    });
  } catch (error) {
    const failure = prismaEmployeeError(error);
    throw new Error(failure?.error ?? "Could not delete the employee.");
  }

  // The Employee filters, and the menu's calendar counts: their calendar
  // entries and answers went with them (lib/filterOptions.ts,
  // lib/calendarEvents.ts).
  revalidateTag(FILTER_TAGS.people);
  revalidateTag(CALENDAR_TAG);
  revalidatePath("/employees");
}

/**
 * Sets a new password for someone who has forgotten theirs. Admins and super
 * admins may; a plain admin cannot reset a super admin's, which would hand
 * them the higher account. Nobody resets their own here: that is Change
 * password on My Profile, which asks for the current one.
 */
export async function resetEmployeePassword(
  employeeId: string,
  password: string,
  confirm: string
): Promise<ResetPasswordState> {
  const sessionUser = await currentUser();

  if (!sessionUser?.id || sessionUser.role !== "admin") {
    return { error: "Only admins can reset passwords." };
  }

  if (employeeId === sessionUser.id) {
    return { error: "Change your own password on My Profile." };
  }

  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { name: true, role: true },
  });

  if (!employee) {
    return { error: "Employee not found." };
  }

  if (employee.role === SUPER_ADMIN && !sessionUser.isSuperAdmin) {
    return { error: "Only a super admin can reset a super admin's password." };
  }

  const weakPassword = passwordError(password);

  if (weakPassword) {
    return { error: weakPassword };
  }

  if (password !== confirm) {
    return { error: "The two passwords do not match." };
  }

  await prisma.user.update({
    where: { id: employeeId },
    data: { password: await bcrypt.hash(password, 10) },
  });
  await logActivity({
    userId: sessionUser.id,
    action: "updated",
    entityType: "employee",
    entityId: employeeId,
    description: `Reset the password of ${employee.name}`,
  });

  return { ok: true };
}
