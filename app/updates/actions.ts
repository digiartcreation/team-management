"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function getSessionUser() {
  const session = await auth();
  const sessionUser = session?.user as
    | (NonNullable<typeof session>["user"] & {
        id?: string;
        role?: string;
      })
    | undefined;

  if (!sessionUser?.id) {
    redirect("/login");
  }

  return sessionUser as typeof sessionUser & { id: string };
}

function handleUpdateError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    throw new Error("Daily update not found.");
  }

  throw error;
}

export async function createDailyUpdate(formData: FormData) {
  const sessionUser = await getSessionUser();
  const date = getValue(formData, "date");
  const todaysTasks = getValue(formData, "todaysTasks");
  const blockers = getValue(formData, "blockers");

  if (!date || !todaysTasks) {
    throw new Error("Date and today's tasks are required.");
  }

  try {
    const update = await prisma.dailyUpdate.create({
      data: {
        userId: sessionUser.id,
        date: new Date(`${date}T00:00:00.000Z`),
        todaysTasks,
        blockers: blockers || null,
      },
      select: { id: true },
    });
    await logActivity({
      userId: sessionUser.id,
      action: "created",
      entityType: "daily_update",
      entityId: update.id,
      description: "Created daily update",
    });
  } catch (error) {
    handleUpdateError(error);
  }

  revalidatePath("/updates");
  redirect("/updates");
}

export async function updateDailyUpdate(formData: FormData) {
  const sessionUser = await getSessionUser();
  const id = getValue(formData, "id");
  const date = getValue(formData, "date");
  const todaysTasks = getValue(formData, "todaysTasks");
  const blockers = getValue(formData, "blockers");

  if (!id || !date || !todaysTasks) {
    throw new Error("Date and today's tasks are required.");
  }

  const existing = await prisma.dailyUpdate.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!existing) {
    throw new Error("Daily update not found.");
  }

  if (existing.userId !== sessionUser.id) {
    redirect("/updates");
  }

  try {
    await prisma.dailyUpdate.update({
      where: { id },
      data: {
        date: new Date(`${date}T00:00:00.000Z`),
        todaysTasks,
        blockers: blockers || null,
      },
    });
    await logActivity({
      userId: sessionUser.id,
      action: "updated",
      entityType: "daily_update",
      entityId: id,
      description: "Updated daily update",
    });
  } catch (error) {
    handleUpdateError(error);
  }

  revalidatePath("/updates");
  redirect("/updates");
}

export async function deleteDailyUpdate(id: string) {
  const sessionUser = await getSessionUser();
  const existing = await prisma.dailyUpdate.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!existing) {
    throw new Error("Daily update not found.");
  }

  if (existing.userId !== sessionUser.id) {
    redirect("/updates");
  }

  try {
    await prisma.dailyUpdate.delete({ where: { id } });
  } catch (error) {
    handleUpdateError(error);
  }

  revalidatePath("/updates");
}
