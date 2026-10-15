"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import {
  isDesignation,
  isDesignationInSector,
  isSector,
} from "@/lib/designations";
import { SUPER_ADMIN } from "@/lib/roles";

const roles = new Set([SUPER_ADMIN, "admin", "manager", "member"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Adding, editing and deleting employees is for super admins; admins only view. */
async function requireSuperAdmin() {
  const session = await auth();
  const sessionUser = session?.user as
    | (NonNullable<typeof session>["user"] & {
        id?: string;
        role?: string;
        isSuperAdmin?: boolean;
      })
    | undefined;

  if (!sessionUser?.isSuperAdmin) {
    redirect("/employees");
  }

  return sessionUser as typeof sessionUser & { id: string };
}

function resolveSectorAndDesignation(formData: FormData) {
  const sector = getValue(formData, "sector") || null;
  const designation = getValue(formData, "designation") || null;

  if (sector && !isSector(sector)) {
    throw new Error("Invalid domain.");
  }

  if (designation) {
    if (!isDesignation(designation)) {
      throw new Error("Invalid designation.");
    }

    if (!isDesignationInSector(designation, sector ?? "")) {
      throw new Error(
        sector
          ? `${designation} is not a designation in ${sector}.`
          : "Choose a domain for this designation."
      );
    }
  }

  return { sector, designation };
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
  const sessionUser = await requireSuperAdmin();

  const name = getValue(formData, "name");
  const email = getValue(formData, "email").toLowerCase();
  const password = getValue(formData, "password");
  const role = getValue(formData, "role");

  if (!name || !email || !password || !roles.has(role)) {
    throw new Error("Invalid employee data.");
  }

  const { sector, designation } = resolveSectorAndDesignation(formData);
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
        sector,
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
  await requireSuperAdmin();

  const id = getValue(formData, "id");
  const name = getValue(formData, "name");
  const email = getValue(formData, "email").toLowerCase();
  const role = getValue(formData, "role");

  if (!id || !name || !email || !roles.has(role)) {
    throw new Error("Invalid employee data.");
  }

  const { sector, designation } = resolveSectorAndDesignation(formData);
  validateEmail(email);

  try {
    await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        role,
        sector,
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
  const sessionUser = await requireSuperAdmin();

  if (sessionUser.id === id) {
    throw new Error("You cannot delete your own account.");
  }

  try {
    await prisma.user.delete({
      where: { id },
    });
  } catch (error) {
    handlePrismaEmployeeError(error);
  }

  revalidatePath("/employees");
}
