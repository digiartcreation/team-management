"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { isDesignation } from "@/lib/designations";
import { SUPER_ADMIN, isSuperAdminRole } from "@/lib/roles";

const roles = new Set([SUPER_ADMIN, "admin", "manager", "member"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function requireAdmin() {
  const session = await auth();
  const sessionUser = session?.user as
    | (NonNullable<typeof session>["user"] & {
        id?: string;
        role?: string;
        isSuperAdmin?: boolean;
      })
    | undefined;

  if (sessionUser?.role !== "admin") {
    redirect("/employees");
  }

  return sessionUser as typeof sessionUser & { id: string };
}

function resolveDesignation(formData: FormData) {
  const designation = getValue(formData, "designation");

  if (!designation) {
    return null;
  }

  if (!isDesignation(designation)) {
    throw new Error("Invalid designation.");
  }

  return designation;
}

/** Only a super admin may create, promote to, or change a super admin. */
function assertCanManageRole(
  sessionUser: { isSuperAdmin?: boolean },
  role: string
) {
  if (isSuperAdminRole(role) && !sessionUser.isSuperAdmin) {
    throw new Error("Only a super admin can manage super admin accounts.");
  }
}

async function assertCanManageEmployee(
  sessionUser: { isSuperAdmin?: boolean },
  id: string
) {
  const target = await prisma.user.findUnique({
    where: { id },
    select: { role: true },
  });

  if (!target) {
    throw new Error("Employee not found.");
  }

  assertCanManageRole(sessionUser, target.role);
}

function validateEmail(email: string) {
  if (!emailPattern.test(email)) {
    throw new Error("Enter a valid email address.");
  }
}

function handlePrismaEmployeeError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new Error("An employee with this email already exists.");
    }

    if (error.code === "P2025") {
      throw new Error("Employee not found.");
    }
  }

  throw error;
}

export async function createEmployee(formData: FormData) {
  const sessionUser = await requireAdmin();

  const name = getValue(formData, "name");
  const email = getValue(formData, "email").toLowerCase();
  const password = getValue(formData, "password");
  const role = getValue(formData, "role");

  if (!name || !email || !password || !roles.has(role)) {
    throw new Error("Invalid employee data.");
  }

  assertCanManageRole(sessionUser, role);
  const designation = resolveDesignation(formData);
  validateEmail(email);

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const employee = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        designation,
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
    handlePrismaEmployeeError(error);
  }

  revalidatePath("/employees");
  redirect("/employees");
}

export async function updateEmployee(formData: FormData) {
  const sessionUser = await requireAdmin();

  const id = getValue(formData, "id");
  const name = getValue(formData, "name");
  const email = getValue(formData, "email").toLowerCase();
  const role = getValue(formData, "role");

  if (!id || !name || !email || !roles.has(role)) {
    throw new Error("Invalid employee data.");
  }

  assertCanManageRole(sessionUser, role);
  await assertCanManageEmployee(sessionUser, id);
  const designation = resolveDesignation(formData);
  validateEmail(email);

  try {
    await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        role,
        designation,
      },
    });
  } catch (error) {
    handlePrismaEmployeeError(error);
  }

  revalidatePath("/employees");
  redirect("/employees");
}

export async function deleteEmployee(id: string) {
  const sessionUser = await requireAdmin();

  if (sessionUser.id === id) {
    throw new Error("You cannot delete your own account.");
  }

  await assertCanManageEmployee(sessionUser, id);

  try {
    await prisma.user.delete({
      where: { id },
    });
  } catch (error) {
    handlePrismaEmployeeError(error);
  }

  revalidatePath("/employees");
}
