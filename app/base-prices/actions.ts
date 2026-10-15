"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { isDesignationInSector, isSector } from "@/lib/designations";
import { SERVICE_OPTIONS } from "@/lib/services";

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function requireSuperAdmin() {
  const session = await auth();
  const sessionUser = session?.user as
    | (NonNullable<typeof session>["user"] & {
        id?: string;
        isSuperAdmin?: boolean;
      })
    | undefined;

  if (!sessionUser?.isSuperAdmin) {
    redirect("/");
  }

  return sessionUser as typeof sessionUser & { id: string };
}

/**
 * Decimal throws on anything it cannot parse, and a posted form is not bound
 * by the browser's number input, so parse failures are turned into a message.
 */
function parseBasePrice(value: string) {
  let amount: Prisma.Decimal;

  try {
    amount = new Prisma.Decimal(value);
  } catch {
    throw new Error("Base price must be a valid amount.");
  }

  if (!amount.isFinite() || amount.isNegative()) {
    throw new Error("Base price must be zero or more.");
  }

  return amount;
}

function readBasePrice(formData: FormData) {
  const service = getValue(formData, "service");
  const sector = getValue(formData, "sector");
  const designation = getValue(formData, "designation");
  const basePrice = getValue(formData, "basePrice");

  if (!SERVICE_OPTIONS.includes(service)) {
    throw new Error("Choose a service.");
  }

  if (!isSector(sector)) {
    throw new Error("Choose a domain.");
  }

  // Every domain has its own Intern, so the domain is part of the price.
  if (!isDesignationInSector(designation, sector)) {
    throw new Error(`Choose a designation from ${sector}.`);
  }

  if (!basePrice) {
    throw new Error("Base price is required.");
  }

  return {
    service,
    sector,
    designation,
    basePrice: parseBasePrice(basePrice),
  };
}

function handlePrismaBasePriceError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new Error(
        "A base price for this service, domain and designation already exists."
      );
    }

    if (error.code === "P2025") {
      throw new Error("Base price not found.");
    }
  }

  throw error;
}

/**
 * Sets the price for a service, domain and designation. When that combination
 * already has one, its amount is updated rather than the save being refused.
 */
export async function createBasePrice(formData: FormData) {
  const sessionUser = await requireSuperAdmin();
  const data = readBasePrice(formData);
  const key = {
    service: data.service,
    sector: data.sector,
    designation: data.designation,
  };

  try {
    const existing = await prisma.basePrice.findUnique({
      where: { service_sector_designation: key },
      select: { id: true },
    });
    const basePrice = await prisma.basePrice.upsert({
      where: { service_sector_designation: key },
      create: data,
      update: { basePrice: data.basePrice },
      select: { id: true },
    });
    await logActivity({
      userId: sessionUser.id,
      action: existing ? "updated" : "created",
      entityType: "basePrice",
      entityId: basePrice.id,
      description: `${existing ? "Updated" : "Set"} base price for ${data.service} (${data.designation}, ${data.sector})`,
    });
  } catch (error) {
    handlePrismaBasePriceError(error);
  }

  revalidatePath("/base-prices");
  redirect("/base-prices");
}

export async function updateBasePrice(formData: FormData) {
  await requireSuperAdmin();

  const id = getValue(formData, "id");

  if (!id) {
    throw new Error("Base price not found.");
  }

  const data = readBasePrice(formData);

  try {
    await prisma.basePrice.update({
      where: { id },
      data,
    });
  } catch (error) {
    handlePrismaBasePriceError(error);
  }

  revalidatePath("/base-prices");
  redirect("/base-prices");
}

export async function deleteBasePrice(id: string) {
  await requireSuperAdmin();

  try {
    await prisma.basePrice.delete({
      where: { id },
    });
  } catch (error) {
    handlePrismaBasePriceError(error);
  }

  revalidatePath("/base-prices");
}
