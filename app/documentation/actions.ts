"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import {
  canManageDocumentation,
  hasDocumentationContent,
  sanitizeDocumentationHtml,
} from "@/lib/documentation";

/** The title column is a VARCHAR(191). */
const MAX_TITLE_LENGTH = 191;

/**
 * Returned to the form rather than thrown: a thrown error swaps the page for
 * the error boundary, and with it whatever had just been written in the editor.
 */
export type DocumentationFormState = { error: string } | null;

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

function readPage(
  formData: FormData
): { error: string } | { title: string; content: string } {
  const title = getValue(formData, "title");
  const content = sanitizeDocumentationHtml(getValue(formData, "content"));

  if (!title) {
    return { error: "Give the page a heading." };
  }

  if (title.length > MAX_TITLE_LENGTH) {
    return {
      error: `Keep the heading under ${MAX_TITLE_LENGTH} characters.`,
    };
  }

  if (!hasDocumentationContent(content)) {
    return { error: "Write something on the page before saving it." };
  }

  return { title, content };
}

export async function createDocumentation(
  _previous: DocumentationFormState,
  formData: FormData
): Promise<DocumentationFormState> {
  const sessionUser = await getSessionUser();
  const page = readPage(formData);

  if ("error" in page) {
    return { error: page.error };
  }

  let id: string;

  try {
    const created = await prisma.documentation.create({
      data: {
        title: page.title,
        content: page.content,
        createdById: sessionUser.id,
      },
      select: { id: true },
    });
    id = created.id;

    await logActivity({
      userId: sessionUser.id,
      action: "created",
      entityType: "documentation",
      entityId: id,
      description: `Created documentation ${page.title}`,
    });
  } catch {
    return { error: "Could not save the page. Please try again." };
  }

  revalidatePath("/documentation");
  redirect(`/documentation/${id}`);
}

export async function updateDocumentation(
  _previous: DocumentationFormState,
  formData: FormData
): Promise<DocumentationFormState> {
  const sessionUser = await getSessionUser();
  const id = getValue(formData, "id");
  const page = readPage(formData);

  if ("error" in page) {
    return { error: page.error };
  }

  const existing = await prisma.documentation.findUnique({
    where: { id },
    select: { createdById: true },
  });

  if (!existing) {
    return { error: "This page no longer exists." };
  }

  if (!canManageDocumentation(sessionUser, existing)) {
    return { error: "Only the page's author or an admin can edit it." };
  }

  try {
    // Pages no longer take attachments; one saved before stays with its page.
    await prisma.documentation.update({
      where: { id },
      data: { title: page.title, content: page.content },
    });

    await logActivity({
      userId: sessionUser.id,
      action: "updated",
      entityType: "documentation",
      entityId: id,
      description: `Updated documentation ${page.title}`,
    });
  } catch {
    return { error: "Could not save the page. Please try again." };
  }

  revalidatePath("/documentation");
  revalidatePath(`/documentation/${id}`);
  redirect(`/documentation/${id}`);
}

export async function deleteDocumentation(id: string) {
  const sessionUser = await getSessionUser();

  const existing = await prisma.documentation.findUnique({
    where: { id },
    select: { title: true, createdById: true },
  });

  if (!existing) {
    throw new Error("Documentation page not found.");
  }

  if (!canManageDocumentation(sessionUser, existing)) {
    throw new Error("Only the page's author or an admin can delete it.");
  }

  // Its images stay: the same upload can have been pasted into another page.
  // Its attachment belongs to it alone and goes with it.
  await prisma.documentation.delete({ where: { id } });

  await logActivity({
    userId: sessionUser.id,
    action: "deleted",
    entityType: "documentation",
    entityId: id,
    description: `Deleted documentation ${existing.title}`,
  });

  revalidatePath("/documentation");
  redirect("/documentation");
}
