"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { createNotification } from "@/lib/notifications";
import { notifyAdminsAndTeamManagers } from "@/lib/recipientNotifications";
import { formatServiceLabel } from "@/lib/services";
import { formatDuration, parseDurationInput } from "@/lib/duration";

const statuses = new Set(["pending", "in_progress", "completed"]);
const priorities = new Set(["low", "medium", "high"]);

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalValue(value: string) {
  return value.length > 0 ? value : null;
}

async function requireTaskEditor() {
  const session = await auth();
  const sessionUser = session?.user as
    | (NonNullable<typeof session>["user"] & {
        role?: string;
      })
    | undefined;

  if (sessionUser?.role !== "admin" && sessionUser?.role !== "manager") {
    redirect("/tasks");
  }

  return sessionUser as typeof sessionUser & { id: string };
}

async function getManagerTeamId(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { teamId: true },
  });

  if (!user?.teamId) {
    throw new Error("You must be assigned to a team before managing tasks.");
  }

  return user.teamId;
}

async function requireTaskDeleteAccess() {
  const session = await auth();
  const sessionUser = session?.user as
    | (NonNullable<typeof session>["user"] & {
        role?: string;
      })
    | undefined;

  if (sessionUser?.role !== "admin") {
    redirect("/tasks");
  }
}

function handlePrismaTaskError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      throw new Error("Task not found.");
    }
  }

  throw error;
}

async function resolveClientMapping(
  clientId: string | null,
  clientWork: string | null
) {
  if (!clientId) {
    // Work is meaningless without a client.
    return { clientId: null, clientWork: null };
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      serviceMappings: {
        select: { service: true, focus: true },
      },
    },
  });

  if (!client) {
    throw new Error("Client not found.");
  }

  const available = client.serviceMappings.map(formatServiceLabel);

  if (available.length === 0) {
    // Nothing to map against yet; keep the client link, drop the work.
    return { clientId, clientWork: null };
  }

  if (!clientWork) {
    throw new Error("Select which work this task is for.");
  }

  if (!available.includes(clientWork)) {
    throw new Error("Selected work is not a service for this client.");
  }

  return { clientId, clientWork };
}

async function validateTaskRelations(
  assignedToId: string | null,
  teamId: string | null,
  managerTeamId?: string
) {
  const [assignedUser, team] = await Promise.all([
    assignedToId
      ? prisma.user.findUnique({
          where: { id: assignedToId },
          select: { id: true, teamId: true },
        })
      : Promise.resolve(null),
    teamId
      ? prisma.team.findUnique({
          where: { id: teamId },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  if (assignedToId && !assignedUser) {
    throw new Error("Assigned employee not found.");
  }

  if (teamId && !team) {
    throw new Error("Team not found.");
  }

  if (managerTeamId) {
    if (teamId !== managerTeamId) {
      throw new Error("Managers can only manage tasks for their own team.");
    }

    if (assignedUser && assignedUser.teamId !== managerTeamId) {
      throw new Error("Managers can only assign tasks to users in their own team.");
    }
  }
}

export async function createTask(formData: FormData) {
  const sessionUser = await requireTaskEditor();

  const title = getValue(formData, "title");
  const description = getValue(formData, "description");
  const assignedToId = optionalValue(getValue(formData, "assignedToId"));
  const requestedTeamId = optionalValue(getValue(formData, "teamId"));
  const requestedClientId = optionalValue(getValue(formData, "clientId"));
  const requestedClientWork = optionalValue(getValue(formData, "clientWork"));
  const status = getValue(formData, "status");
  const priority = getValue(formData, "priority");
  const managerTeamId =
    sessionUser.role === "manager" ? await getManagerTeamId(sessionUser.id) : undefined;
  const teamId = managerTeamId ?? requestedTeamId;

  if (!title) {
    throw new Error("Task title is required.");
  }

  if (!statuses.has(status) || !priorities.has(priority)) {
    throw new Error("Invalid task status or priority.");
  }

  await validateTaskRelations(assignedToId, teamId, managerTeamId);
  const { clientId, clientWork } = await resolveClientMapping(
    requestedClientId,
    requestedClientWork
  );

  try {
    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        assignedToId,
        teamId,
        clientId,
        clientWork,
        status,
        priority,
      },
      select: { id: true },
    });
    await logActivity({
      userId: sessionUser.id,
      action: "created",
      entityType: "task",
      entityId: task.id,
      description: `Created task ${title}`,
    });
    if (assignedToId) {
      await createNotification({
        userId: assignedToId,
        title: "Task assigned",
        message: `You were assigned: ${title}`,
        type: "TASK_ASSIGNED",
      });
    }
  } catch (error) {
    handlePrismaTaskError(error);
  }

  revalidatePath("/tasks");
  revalidatePath("/");
  redirect("/tasks");
}

export async function updateTask(formData: FormData) {
  const sessionUser = await requireTaskEditor();

  const id = getValue(formData, "id");
  const title = getValue(formData, "title");
  const description = getValue(formData, "description");
  const assignedToId = optionalValue(getValue(formData, "assignedToId"));
  const requestedTeamId = optionalValue(getValue(formData, "teamId"));
  const requestedClientId = optionalValue(getValue(formData, "clientId"));
  const requestedClientWork = optionalValue(getValue(formData, "clientWork"));
  const status = getValue(formData, "status");
  const priority = getValue(formData, "priority");
  const managerTeamId =
    sessionUser.role === "manager" ? await getManagerTeamId(sessionUser.id) : undefined;
  const teamId = managerTeamId ?? requestedTeamId;

  if (!id || !title) {
    throw new Error("Task title is required.");
  }

  if (!statuses.has(status) || !priorities.has(priority)) {
    throw new Error("Invalid task status or priority.");
  }

  await validateTaskRelations(assignedToId, teamId, managerTeamId);
  const { clientId, clientWork } = await resolveClientMapping(
    requestedClientId,
    requestedClientWork
  );

  try {
    const previous = await prisma.task.findUnique({
      where: { id },
      select: { assignedToId: true, status: true, teamId: true },
    });

    if (!previous) {
      throw new Error("Task not found.");
    }

    if (managerTeamId && previous.teamId !== managerTeamId) {
      throw new Error("Managers can only edit tasks for their own team.");
    }

    await prisma.task.update({
      where: { id },
      data: {
        title,
        description: description || null,
        assignedToId,
        teamId,
        clientId,
        clientWork,
        status,
        priority,
      },
    });
    await logActivity({
      userId: sessionUser.id,
      action: "updated",
      entityType: "task",
      entityId: id,
      description: `Updated task ${title}`,
    });
    if (assignedToId && assignedToId !== previous?.assignedToId) {
      await createNotification({
        userId: assignedToId,
        title: "Task assigned",
        message: `You were assigned: ${title}`,
        type: "TASK_ASSIGNED",
      });
    }
    if (assignedToId && status === "completed" && previous?.status !== "completed") {
      await createNotification({
        userId: assignedToId,
        title: "Task completed",
        message: `Task completed: ${title}`,
        type: "TASK_COMPLETED",
      });
    } else if (assignedToId && previous?.status !== status) {
      await createNotification({
        userId: assignedToId,
        title: "Task updated",
        message: `Task status changed: ${title}`,
        type: "TASK_UPDATED",
      });
    }
  } catch (error) {
    handlePrismaTaskError(error);
  }

  revalidatePath("/tasks");
  revalidatePath("/");
  redirect("/tasks");
}

export async function deleteTask(id: string) {
  await requireTaskDeleteAccess();

  try {
    await prisma.task.delete({
      where: { id },
    });
  } catch (error) {
    handlePrismaTaskError(error);
  }

  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function updateOwnTaskStatus(formData: FormData) {
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

  const id = getValue(formData, "id");
  const status = getValue(formData, "status");

  if (!id || !statuses.has(status)) {
    throw new Error("Invalid task status.");
  }

  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      assignedToId: true,
      teamId: true,
    },
  });

  if (!task) {
    throw new Error("Task not found.");
  }

  let canUpdateStatus = false;

  if (sessionUser.role === "admin") {
    canUpdateStatus = true;
  } else if (sessionUser.role === "manager") {
    const managerTeamId = await getManagerTeamId(sessionUser.id);
    canUpdateStatus = task.teamId === managerTeamId;
  } else {
    canUpdateStatus = task.assignedToId === sessionUser.id;
  }

  if (!canUpdateStatus) {
    redirect("/tasks");
  }

  try {
    const previous = await prisma.task.findUnique({
      where: { id },
      select: { assignedToId: true, title: true, status: true },
    });
    await prisma.task.update({
      where: { id },
      data: { status },
    });
    await logActivity({
      userId: sessionUser.id,
      action: "updated",
      entityType: "task",
      entityId: id,
      description: `Updated task status for ${previous?.title ?? "task"}`,
    });
    if (sessionUser.role === "member") {
      const user = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { name: true },
      });
      await notifyAdminsAndTeamManagers({
        actorUserId: sessionUser.id,
        title: status === "completed" ? "Task completed" : "Task status updated",
        message: `${user?.name ?? "An employee"} marked task "${previous?.title ?? "task"}" as ${status.replace("_", " ")}.`,
        type: "TASK_UPDATED",
      });
    } else if (previous?.assignedToId && previous.assignedToId !== sessionUser.id) {
      if (status === "completed" && previous.status !== "completed") {
        await createNotification({
          userId: previous.assignedToId,
          title: "Task completed",
          message: `Task completed: ${previous.title}`,
          type: "TASK_COMPLETED",
        });
      } else if (previous.status !== status) {
        await createNotification({
          userId: previous.assignedToId,
          title: "Task updated",
          message: `Task status changed: ${previous.title}`,
          type: "TASK_UPDATED",
        });
      }
    }
  } catch (error) {
    handlePrismaTaskError(error);
  }

  revalidatePath("/tasks");
  revalidatePath("/");
}

/** "YYYY-MM-DD" from the date input, as UTC midnight so the day never shifts. */
function parseLogDate(raw: string) {
  if (!raw) {
    throw new Error("Select the date the work was done.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error("Select a valid date.");
  }

  const date = new Date(`${raw}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Select a valid date.");
  }

  // Compare against tomorrow UTC so "today" is valid in every timezone.
  const cutoff = new Date();
  cutoff.setUTCHours(0, 0, 0, 0);
  cutoff.setUTCDate(cutoff.getUTCDate() + 1);

  if (date > cutoff) {
    throw new Error("Time cannot be logged for a future date.");
  }

  return date;
}

/**
 * Anyone on the team that owns the task may log against it, not just the
 * assignee. Tasks with no team fall back to the assignee, so a personal task
 * is not left unloggable.
 */
async function canLogTaskTime(
  userId: string,
  role: string | undefined,
  task: { teamId: string | null; assignedToId: string | null }
) {
  if (role === "admin") {
    return true;
  }

  if (task.assignedToId === userId) {
    return true;
  }

  if (!task.teamId) {
    return false;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { teamId: true },
  });

  return Boolean(user?.teamId) && user?.teamId === task.teamId;
}

/**
 * Returned to the log-time dialog instead of thrown, so a bad entry shows an
 * inline message in the dialog rather than replacing the page with the error
 * boundary.
 */
export type LogTimeState = { ok: true } | { error: string } | null;

export async function logTaskTime(
  _previous: LogTimeState,
  formData: FormData
): Promise<LogTimeState> {
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

  const taskId = getValue(formData, "taskId");

  if (!taskId) {
    return { error: "Task not found." };
  }

  let minutes: number;
  let date: Date;

  try {
    minutes = parseDurationInput(
      getValue(formData, "hours"),
      getValue(formData, "minutes")
    );
    date = parseLogDate(getValue(formData, "date"));
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid time entry.",
    };
  }

  const note = getValue(formData, "note");

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { title: true, teamId: true, assignedToId: true },
  });

  if (!task) {
    return { error: "Task not found." };
  }

  if (!(await canLogTaskTime(sessionUser.id, sessionUser.role, task))) {
    return { error: "You cannot log time on this task." };
  }

  try {
    await prisma.taskTimeLog.create({
      data: {
        taskId,
        userId: sessionUser.id,
        minutes,
        date,
        note: note || null,
      },
    });

    await logActivity({
      userId: sessionUser.id,
      action: "logged",
      entityType: "task",
      entityId: taskId,
      description: `Logged ${formatDuration(minutes)} on task ${task.title}`,
    });
  } catch {
    return { error: "Could not save the time entry. Please try again." };
  }

  revalidatePath("/tasks");
  revalidatePath("/reports");
  revalidatePath("/");

  return { ok: true };
}
