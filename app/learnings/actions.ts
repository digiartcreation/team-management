"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

const categories = new Set([
  "Development",
  "Design",
  "Marketing",
  "Research",
  "AI Tools",
  "Other",
]);

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

function handleLearningError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    throw new Error("Learning not found.");
  }

  throw error;
}

export async function createLearning(formData: FormData) {
  const sessionUser = await getSessionUser();
  const title = getValue(formData, "title");
  const description = getValue(formData, "description");
  const category = getValue(formData, "category");
  const referenceLink = getValue(formData, "referenceLink");

  if (!title || !description || !categories.has(category)) {
    throw new Error("Title, description, and category are required.");
  }

  try {
    const learning = await prisma.learning.create({
      data: {
        userId: sessionUser.id,
        title,
        description,
        category,
        referenceLink: referenceLink || null,
      },
      select: { id: true },
    });
    await logActivity({
      userId: sessionUser.id,
      action: "created",
      entityType: "learning",
      entityId: learning.id,
      description: `Created learning ${title}`,
    });
  } catch (error) {
    handleLearningError(error);
  }

  revalidatePath("/learnings");
  redirect("/learnings");
}

export async function updateLearning(formData: FormData) {
  const sessionUser = await getSessionUser();
  const id = getValue(formData, "id");
  const title = getValue(formData, "title");
  const description = getValue(formData, "description");
  const category = getValue(formData, "category");
  const referenceLink = getValue(formData, "referenceLink");

  if (!id || !title || !description || !categories.has(category)) {
    throw new Error("Title, description, and category are required.");
  }

  const existing = await prisma.learning.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!existing) {
    throw new Error("Learning not found.");
  }

  if (existing.userId !== sessionUser.id) {
    redirect("/learnings");
  }

  try {
    await prisma.learning.update({
      where: { id },
      data: {
        title,
        description,
        category,
        referenceLink: referenceLink || null,
      },
    });
    await logActivity({
      userId: sessionUser.id,
      action: "updated",
      entityType: "learning",
      entityId: id,
      description: `Updated learning ${title}`,
    });
  } catch (error) {
    handleLearningError(error);
  }

  revalidatePath("/learnings");
  redirect("/learnings");
}

export async function deleteLearning(id: string) {
  const sessionUser = await getSessionUser();
  const existing = await prisma.learning.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!existing) {
    throw new Error("Learning not found.");
  }

  if (existing.userId !== sessionUser.id) {
    redirect("/learnings");
  }

  try {
    await prisma.learning.delete({ where: { id } });
  } catch (error) {
    handleLearningError(error);
  }

  revalidatePath("/learnings");
}
