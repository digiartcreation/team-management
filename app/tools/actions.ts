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
    | (NonNullable<typeof session>["user"] & { id?: string; role?: string })
    | undefined;
  if (!sessionUser?.id) redirect("/login");
  return sessionUser as typeof sessionUser & { id: string };
}

function handleToolError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    throw new Error("Tool usage entry not found.");
  }
  throw error;
}

export async function createToolUsage(formData: FormData) {
  const sessionUser = await getSessionUser();
  const toolName = getValue(formData, "toolName");
  const category = getValue(formData, "category");
  const purpose = getValue(formData, "purpose");
  const timeSpent = getValue(formData, "timeSpent");
  const outcome = getValue(formData, "outcome");
  const date = getValue(formData, "date");

  if (!toolName || !category || !purpose || !timeSpent || !date) {
    throw new Error("Tool name, category, purpose, time spent, and date are required.");
  }

  try {
    const entry = await prisma.toolUsage.create({
      data: {
        userId: sessionUser.id,
        toolName,
        category,
        purpose,
        timeSpent,
        outcome: outcome || null,
        date: new Date(`${date}T00:00:00.000Z`),
      },
      select: { id: true },
    });
    await logActivity({
      userId: sessionUser.id,
      action: "created",
      entityType: "tool_usage",
      entityId: entry.id,
      description: `Created tool usage for ${toolName}`,
    });
  } catch (error) {
    handleToolError(error);
  }

  revalidatePath("/tools");
  redirect("/tools");
}

export async function updateToolUsage(formData: FormData) {
  const sessionUser = await getSessionUser();
  const id = getValue(formData, "id");
  const toolName = getValue(formData, "toolName");
  const category = getValue(formData, "category");
  const purpose = getValue(formData, "purpose");
  const timeSpent = getValue(formData, "timeSpent");
  const outcome = getValue(formData, "outcome");
  const date = getValue(formData, "date");

  if (!id || !toolName || !category || !purpose || !timeSpent || !date) {
    throw new Error("Tool name, category, purpose, time spent, and date are required.");
  }

  const existing = await prisma.toolUsage.findUnique({ where: { id }, select: { userId: true } });
  if (!existing) throw new Error("Tool usage entry not found.");
  if (existing.userId !== sessionUser.id) redirect("/tools");

  try {
    await prisma.toolUsage.update({
      where: { id },
      data: {
        toolName,
        category,
        purpose,
        timeSpent,
        outcome: outcome || null,
        date: new Date(`${date}T00:00:00.000Z`),
      },
    });
    await logActivity({
      userId: sessionUser.id,
      action: "updated",
      entityType: "tool_usage",
      entityId: id,
      description: `Updated tool usage for ${toolName}`,
    });
  } catch (error) {
    handleToolError(error);
  }

  revalidatePath("/tools");
  redirect("/tools");
}

export async function deleteToolUsage(id: string) {
  const sessionUser = await getSessionUser();
  const existing = await prisma.toolUsage.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!existing) throw new Error("Tool usage entry not found.");
  if (existing.userId !== sessionUser.id) redirect("/tools");

  try {
    await prisma.toolUsage.delete({ where: { id } });
  } catch (error) {
    handleToolError(error);
  }

  revalidatePath("/tools");
}
