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

function getMemberIds(formData: FormData) {
  return formData
    .getAll("memberIds")
    .filter((value): value is string => typeof value === "string");
}

async function requireAdmin() {
  const session = await auth();
  const sessionUser = session?.user as
    | (NonNullable<typeof session>["user"] & {
        role?: string;
      })
    | undefined;

  if (sessionUser?.role !== "admin") {
    redirect("/teams");
  }

  return sessionUser as typeof sessionUser & { id: string };
}

function handlePrismaTeamError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new Error("A team with this name already exists.");
    }

    if (error.code === "P2025") {
      throw new Error("Team not found.");
    }
  }

  throw error;
}

async function assignMembers(teamId: string, memberIds: string[]) {
  await prisma.user.updateMany({
    where: {
      teamId,
      id: {
        notIn: memberIds,
      },
    },
    data: {
      teamId: null,
    },
  });

  if (memberIds.length > 0) {
    await prisma.user.updateMany({
      where: {
        id: {
          in: memberIds,
        },
      },
      data: {
        teamId,
      },
    });
  }
}

export async function createTeam(formData: FormData) {
  const sessionUser = await requireAdmin();

  const name = getValue(formData, "name");
  const description = getValue(formData, "description");
  const memberIds = getMemberIds(formData);

  if (!name) {
    throw new Error("Team name is required.");
  }

  try {
    const team = await prisma.team.create({
      data: {
        name,
        description: description || null,
      },
      select: {
        id: true,
      },
    });

    await assignMembers(team.id, memberIds);
    await logActivity({
      userId: sessionUser.id,
      action: "created",
      entityType: "team",
      entityId: team.id,
      description: `Created team ${name}`,
    });
  } catch (error) {
    handlePrismaTeamError(error);
  }

  revalidatePath("/teams");
  redirect("/teams");
}

export async function updateTeam(formData: FormData) {
  await requireAdmin();

  const id = getValue(formData, "id");
  const name = getValue(formData, "name");
  const description = getValue(formData, "description");
  const memberIds = getMemberIds(formData);

  if (!id || !name) {
    throw new Error("Team name is required.");
  }

  try {
    await prisma.team.update({
      where: { id },
      data: {
        name,
        description: description || null,
      },
    });

    await assignMembers(id, memberIds);
  } catch (error) {
    handlePrismaTeamError(error);
  }

  revalidatePath("/teams");
  redirect("/teams");
}

export async function deleteTeam(id: string) {
  await requireAdmin();

  try {
    await prisma.team.delete({
      where: { id },
    });
  } catch (error) {
    handlePrismaTeamError(error);
  }

  revalidatePath("/teams");
}
