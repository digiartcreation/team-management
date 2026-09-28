"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ADMIN_ROLES } from "@/lib/roles";
import { logActivity } from "@/lib/activity";
import { createNotification } from "@/lib/notifications";

const feedbackTypes = new Set(["Suggestion", "Issue Report"]);
const priorities = new Set(["Low", "Medium", "High"]);
const statuses = new Set(["Open", "Under Review", "Resolved", "Closed"]);

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function getSessionUser() {
  const session = await auth();
  const sessionUser = session?.user as
    | (NonNullable<typeof session>["user"] & { id?: string; role?: string })
    | undefined;

  if (!sessionUser?.id) {
    redirect("/login");
  }

  return sessionUser as typeof sessionUser & { id: string };
}

function handleFeedbackError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    throw new Error("Feedback submission not found.");
  }

  throw error;
}

async function notifyAdmins(title: string, message: string) {
  const admins = await prisma.user.findMany({
    where: { role: { in: ADMIN_ROLES } },
    select: { id: true },
  });

  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        title,
        message,
        type: "FEEDBACK_SUBMITTED",
      })
    )
  );
}

export async function createFeedbackSubmission(formData: FormData) {
  const sessionUser = await getSessionUser();
  const type = getValue(formData, "type");
  const title = getValue(formData, "title");
  const description = getValue(formData, "description");
  const priority = getValue(formData, "priority") || "Medium";

  if (!feedbackTypes.has(type) || !title || !description || !priorities.has(priority)) {
    throw new Error("Enter a valid type, title, description, and priority.");
  }

  try {
    const submission = await prisma.feedbackSubmission.create({
      data: {
        userId: sessionUser.id,
        type,
        title,
        description,
        priority,
      },
      select: { id: true },
    });
    await logActivity({
      userId: sessionUser.id,
      action: "created",
      entityType: "feedback_submission",
      entityId: submission.id,
      description: `Created ${type.toLowerCase()} submission`,
    });
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { name: true },
    });
    await notifyAdmins(
      `${type} submitted`,
      `${user?.name ?? "A team member"} submitted ${title}.`
    );
  } catch (error) {
    handleFeedbackError(error);
  }

  revalidatePath("/feedback/submissions");
  redirect("/feedback/submissions");
}

export async function updateFeedbackStatus(formData: FormData) {
  const sessionUser = await getSessionUser();

  if (sessionUser.role !== "admin") {
    redirect("/feedback/submissions");
  }

  const id = getValue(formData, "id");
  const status = getValue(formData, "status");
  const adminResponse = getValue(formData, "adminResponse");

  if (!id || !statuses.has(status)) {
    throw new Error("Select a valid status.");
  }

  try {
    const submission = await prisma.feedbackSubmission.update({
      where: { id },
      data: {
        status,
        adminResponse: adminResponse || null,
      },
      select: { id: true, userId: true, title: true },
    });
    await createNotification({
      userId: submission.userId,
      title: "Feedback status updated",
      message: "Your feedback submission status has been updated.",
      type: "FEEDBACK_UPDATED",
    });
    await logActivity({
      userId: sessionUser.id,
      action: "updated",
      entityType: "feedback_submission",
      entityId: submission.id,
      description: `Updated feedback status for ${submission.title}`,
    });
  } catch (error) {
    handleFeedbackError(error);
  }

  revalidatePath("/feedback/submissions");
}
