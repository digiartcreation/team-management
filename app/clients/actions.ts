"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { CLIENT_STATUS_OPTIONS } from "@/lib/services";
import { parseServiceMappings } from "@/lib/clientServices";
import { readSopUpload } from "@/lib/uploads";

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getStatus(formData: FormData) {
  const status = getValue(formData, "status");
  return CLIENT_STATUS_OPTIONS.includes(status) ? status : "Active";
}

async function requireAdmin() {
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

  if (sessionUser.role !== "admin") {
    redirect("/");
  }

  return sessionUser as typeof sessionUser & { id: string };
}

function handlePrismaClientError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new Error("A client with this name already exists.");
    }

    if (error.code === "P2025") {
      throw new Error("Client not found.");
    }
  }

  throw error;
}

export async function createClient(formData: FormData) {
  const sessionUser = await requireAdmin();

  const name = getValue(formData, "name");
  const contactPerson = getValue(formData, "contactPerson");
  const owner = getValue(formData, "owner");
  const communicationPerson = getValue(formData, "communicationPerson");
  const email = getValue(formData, "email");
  const phone = getValue(formData, "phone");
  const notes = getValue(formData, "notes");
  const serviceMappings = parseServiceMappings(formData);
  const status = getStatus(formData);

  if (!name) {
    throw new Error("Client name is required.");
  }

  const sop = await readSopUpload(formData.get("sop"));

  try {
    const client = await prisma.client.create({
      data: {
        name,
        contactPerson: contactPerson || null,
        owner: owner || null,
        communicationPerson: communicationPerson || null,
        email: email || null,
        phone: phone || null,
        status,
        notes: notes || null,
        createdById: sessionUser.id,
        serviceMappings: {
          create: serviceMappings,
        },
        ...(sop
          ? { sop: { create: { ...sop, uploadedById: sessionUser.id } } }
          : {}),
      },
      select: {
        id: true,
      },
    });

    await logActivity({
      userId: sessionUser.id,
      action: "created",
      entityType: "client",
      entityId: client.id,
      description: `Created client ${name}`,
    });
  } catch (error) {
    handlePrismaClientError(error);
  }

  revalidatePath("/clients");
  redirect("/clients");
}

export async function updateClient(formData: FormData) {
  const sessionUser = await requireAdmin();

  const id = getValue(formData, "id");
  const name = getValue(formData, "name");
  const contactPerson = getValue(formData, "contactPerson");
  const owner = getValue(formData, "owner");
  const communicationPerson = getValue(formData, "communicationPerson");
  const email = getValue(formData, "email");
  const phone = getValue(formData, "phone");
  const notes = getValue(formData, "notes");
  const serviceMappings = parseServiceMappings(formData);
  const status = getStatus(formData);
  // A newly picked file replaces the SOP; ticking Remove with none picked
  // deletes it; doing neither leaves the saved one alone.
  const removeSop = getValue(formData, "removeSop") === "on";

  if (!id || !name) {
    throw new Error("Client name is required.");
  }

  const sop = await readSopUpload(formData.get("sop"));

  try {
    // Replace the mapping wholesale in one transaction: a service can be
    // unticked, and its payment terms must not survive as an orphan row.
    const operations: Prisma.PrismaPromise<unknown>[] = [
      prisma.clientService.deleteMany({ where: { clientId: id } }),
      prisma.client.update({
        where: { id },
        data: {
          name,
          contactPerson: contactPerson || null,
          owner: owner || null,
          communicationPerson: communicationPerson || null,
          email: email || null,
          phone: phone || null,
          status,
          notes: notes || null,
          serviceMappings: {
            create: serviceMappings,
          },
        },
      }),
    ];

    if (sop) {
      operations.push(
        prisma.clientSop.upsert({
          where: { clientId: id },
          create: { ...sop, clientId: id, uploadedById: sessionUser.id },
          update: { ...sop, uploadedById: sessionUser.id },
        })
      );
    } else if (removeSop) {
      operations.push(prisma.clientSop.deleteMany({ where: { clientId: id } }));
    }

    await prisma.$transaction(operations);

    await logActivity({
      userId: sessionUser.id,
      action: "updated",
      entityType: "client",
      entityId: id,
      description: `Updated client ${name}`,
    });
  } catch (error) {
    handlePrismaClientError(error);
  }

  revalidatePath("/clients");
  redirect("/clients");
}

/** Takes the SOP off a client, leaving the client itself as it is. */
export async function deleteClientSop(clientId: string) {
  const sessionUser = await requireAdmin();

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { name: true },
  });

  if (!client) {
    throw new Error("Client not found.");
  }

  await prisma.clientSop.deleteMany({ where: { clientId } });

  await logActivity({
    userId: sessionUser.id,
    action: "deleted",
    entityType: "client",
    entityId: clientId,
    description: `Deleted the SOP of client ${client.name}`,
  });

  revalidatePath("/clients");
}

export async function deleteClient(id: string) {
  const sessionUser = await requireAdmin();

  const existing = await prisma.client.findUnique({
    where: { id },
    select: { name: true },
  });

  if (!existing) {
    throw new Error("Client not found.");
  }

  try {
    await prisma.client.delete({
      where: { id },
    });

    await logActivity({
      userId: sessionUser.id,
      action: "deleted",
      entityType: "client",
      entityId: id,
      description: `Deleted client ${existing.name}`,
    });
  } catch (error) {
    handlePrismaClientError(error);
  }

  revalidatePath("/clients");
}
