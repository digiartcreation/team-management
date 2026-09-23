"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { createNotification } from "@/lib/notifications";
import { notifyAdminsAndTeamManagers } from "@/lib/recipientNotifications";
import { DIGITAL_MARKETING, formatServiceLabel } from "@/lib/services";
import { formatDuration } from "@/lib/duration";
import {
  canReopenFrom,
  formatTaskStatus,
  isOnReopenCycle,
  isTaskStatus,
} from "@/lib/taskStatus";

const priorities = new Set(["low", "medium", "high"]);

const REOPEN_NEEDS_COMPLETED = "Only a completed task can be reopened.";

/**
 * What a status change means for the reopen bookkeeping. Sending a completed
 * task back starts a new cycle: the counter on the task goes up and a
 * TaskReopen row records who did it and why. Every other move leaves both
 * alone -- including re-saving a task that is already reopened, which is not a
 * second reopen.
 */
function resolveReopenCycle(
  previousStatus: string,
  nextStatus: string,
  reopenCount: number
) {
  if (nextStatus !== "reopened" || previousStatus === "reopened") {
    return null;
  }

  if (!canReopenFrom(previousStatus)) {
    throw new Error(REOPEN_NEEDS_COMPLETED);
  }

  return reopenCount + 1;
}

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function optionalValue(value: string) {
  return value.length > 0 ? value : null;
}

function resolveDigitalMarketingAmount(
  clientWork: string | null,
  value: string
) {
  if (!clientWork?.startsWith(DIGITAL_MARKETING)) {
    return null;
  }

  if (!value) {
    throw new Error("Enter an amount for Digital Marketing work.");
  }

  // Decimal throws on anything it cannot parse, so the guard below never gets
  // to run on "abc". The browser's number input stops that, but a posted form
  // does not, and the raw throw reaches the error boundary instead of the form.
  let amount: Prisma.Decimal;

  try {
    amount = new Prisma.Decimal(value);
  } catch {
    throw new Error("Digital Marketing amount must be a valid non-negative amount.");
  }

  if (!amount.isFinite() || amount.isNegative()) {
    throw new Error("Digital Marketing amount must be a valid non-negative amount.");
  }

  return amount;
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
  const requestedDigitalMarketingAmount = getValue(formData, "digitalMarketingAmount");
  const status = getValue(formData, "status");
  const priority = getValue(formData, "priority");
  const managerTeamId =
    sessionUser.role === "manager" ? await getManagerTeamId(sessionUser.id) : undefined;
  const teamId = managerTeamId ?? requestedTeamId;

  if (!title) {
    throw new Error("Task title is required.");
  }

  if (!isTaskStatus(status) || !priorities.has(priority)) {
    throw new Error("Invalid task status or priority.");
  }

  if (status === "reopened") {
    throw new Error("A new task cannot start out reopened.");
  }

  await validateTaskRelations(assignedToId, teamId, managerTeamId);
  const { clientId, clientWork } = await resolveClientMapping(
    requestedClientId,
    requestedClientWork
  );
  const digitalMarketingAmount = resolveDigitalMarketingAmount(
    clientWork,
    requestedDigitalMarketingAmount
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
        digitalMarketingAmount,
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
  revalidatePath("/manager");
  revalidatePath("/member");
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
  const requestedDigitalMarketingAmount = getValue(formData, "digitalMarketingAmount");
  const status = getValue(formData, "status");
  const priority = getValue(formData, "priority");
  const managerTeamId =
    sessionUser.role === "manager" ? await getManagerTeamId(sessionUser.id) : undefined;
  const teamId = managerTeamId ?? requestedTeamId;

  if (!id || !title) {
    throw new Error("Task title is required.");
  }

  if (!isTaskStatus(status) || !priorities.has(priority)) {
    throw new Error("Invalid task status or priority.");
  }

  await validateTaskRelations(assignedToId, teamId, managerTeamId);
  const { clientId, clientWork } = await resolveClientMapping(
    requestedClientId,
    requestedClientWork
  );
  const digitalMarketingAmount = resolveDigitalMarketingAmount(
    clientWork,
    requestedDigitalMarketingAmount
  );

  try {
    const previous = await prisma.task.findUnique({
      where: { id },
      select: {
        assignedToId: true,
        status: true,
        teamId: true,
        reopenCount: true,
      },
    });

    if (!previous) {
      throw new Error("Task not found.");
    }

    if (managerTeamId && previous.teamId !== managerTeamId) {
      throw new Error("Managers can only edit tasks for their own team.");
    }

    const reopenCycle = resolveReopenCycle(
      previous.status,
      status,
      previous.reopenCount
    );

    const update = prisma.task.update({
      where: { id },
      data: {
        title,
        description: description || null,
        assignedToId,
        teamId,
        clientId,
        clientWork,
        digitalMarketingAmount,
        status,
        priority,
        ...(reopenCycle ? { reopenCount: reopenCycle } : {}),
      },
    });

    // The counter and the reopen row have to agree, so they are written
    // together. The task form has nowhere to ask for a reason, hence none.
    if (reopenCycle) {
      await prisma.$transaction([
        update,
        prisma.taskReopen.create({
          data: {
            taskId: id,
            userId: sessionUser.id,
            cycle: reopenCycle,
            reason: null,
          },
        }),
      ]);
    } else {
      await update;
    }

    await logActivity({
      userId: sessionUser.id,
      action: reopenCycle ? "reopened" : "updated",
      entityType: "task",
      entityId: id,
      description: reopenCycle
        ? `Reopened task ${title} (reopen ${reopenCycle})`
        : `Updated task ${title}`,
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
    } else if (assignedToId && reopenCycle) {
      await createNotification({
        userId: assignedToId,
        title: "Task reopened",
        message: `Task reopened for more work: ${title}`,
        type: "TASK_UPDATED",
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
  revalidatePath("/manager");
  revalidatePath("/member");
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

/**
 * Who may move a task's status. Admins anywhere, managers within their own
 * team, everyone else only on a task assigned to them.
 */
async function canUpdateTaskStatus(
  userId: string,
  role: string | undefined,
  task: { teamId: string | null; assignedToId: string | null }
) {
  if (role === "admin") {
    return true;
  }

  if (role === "manager") {
    return task.teamId === (await getManagerTeamId(userId));
  }

  return task.assignedToId === userId;
}

const COMPLETION_NEEDS_TIME =
  "Log the time spent before marking this task completed.";

const REOPEN_COMPLETION_NEEDS_TIME =
  "Log the time spent on this reopen before completing the task again.";

/**
 * A task cannot be completed with nothing logged against the run it is on --
 * completed work is what gets billed, so its hours have to exist. After a
 * reopen that means hours on the new cycle: the original run is already
 * accounted for and cannot stand in for the rework.
 *
 * Only the move INTO completed is gated: a task already completed (including
 * one completed before this rule) can still have its status re-saved without
 * being held hostage to it. Returns the message to raise, or null when the move
 * is allowed.
 */
async function completionTimeError(
  taskId: string,
  status: string,
  task: { status: string; reopenCount: number }
) {
  if (status !== "completed" || task.status === "completed") {
    return null;
  }

  const logged = await prisma.taskTimeLog.count({
    where: { taskId, reopenCycle: task.reopenCount },
  });

  if (logged > 0) {
    return null;
  }

  return isOnReopenCycle(task.reopenCount)
    ? REOPEN_COMPLETION_NEEDS_TIME
    : COMPLETION_NEEDS_TIME;
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
  const reopenReason = getValue(formData, "reopenReason");

  if (!id || !isTaskStatus(status)) {
    throw new Error("Invalid task status.");
  }

  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      assignedToId: true,
      teamId: true,
      title: true,
      status: true,
      reopenCount: true,
    },
  });

  if (!task) {
    throw new Error("Task not found.");
  }

  if (!(await canUpdateTaskStatus(sessionUser.id, sessionUser.role, task))) {
    redirect("/tasks");
  }

  const blockedCompletion = await completionTimeError(id, status, task);

  if (blockedCompletion) {
    throw new Error(blockedCompletion);
  }

  const reopenCycle = resolveReopenCycle(task.status, status, task.reopenCount);

  try {
    const update = prisma.task.update({
      where: { id },
      data: {
        status,
        ...(reopenCycle ? { reopenCount: reopenCycle } : {}),
      },
    });

    // The counter and the reopen row have to agree, so they are written
    // together: a cycle with no record of why it opened is worse than no cycle.
    if (reopenCycle) {
      await prisma.$transaction([
        update,
        prisma.taskReopen.create({
          data: {
            taskId: id,
            userId: sessionUser.id,
            cycle: reopenCycle,
            reason: reopenReason || null,
          },
        }),
      ]);
    } else {
      await update;
    }

    await logActivity({
      userId: sessionUser.id,
      action: reopenCycle ? "reopened" : "updated",
      entityType: "task",
      entityId: id,
      description: reopenCycle
        ? `Reopened task ${task.title} (reopen ${reopenCycle})`
        : `Updated task status for ${task.title}`,
    });
    if (sessionUser.role === "member") {
      const user = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { name: true },
      });
      await notifyAdminsAndTeamManagers({
        actorUserId: sessionUser.id,
        title:
          status === "completed"
            ? "Task completed"
            : reopenCycle
              ? "Task reopened"
              : "Task status updated",
        message: `${user?.name ?? "An employee"} marked task "${task.title}" as ${formatTaskStatus(status)}.`,
        type: "TASK_UPDATED",
      });
    } else if (task.assignedToId && task.assignedToId !== sessionUser.id) {
      if (status === "completed" && task.status !== "completed") {
        await createNotification({
          userId: task.assignedToId,
          title: "Task completed",
          message: `Task completed: ${task.title}`,
          type: "TASK_COMPLETED",
        });
      } else if (reopenCycle) {
        await createNotification({
          userId: task.assignedToId,
          title: "Task reopened",
          message: `Task reopened for more work: ${task.title}`,
          type: "TASK_UPDATED",
        });
      } else if (task.status !== status) {
        await createNotification({
          userId: task.assignedToId,
          title: "Task updated",
          message: `Task status changed: ${task.title}`,
          type: "TASK_UPDATED",
        });
      }
    }
  } catch (error) {
    handlePrismaTaskError(error);
  }

  revalidatePath("/tasks");
  revalidatePath("/");
  revalidatePath("/manager");
  revalidatePath("/member");
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
    minutes = Number(getValue(formData, "durationMinutes"));
    if (
      !Number.isInteger(minutes) ||
      minutes < 30 ||
      minutes > 8 * 60 ||
      minutes % 15
    ) {
      throw new Error("Select a time between 30 minutes and 8 hours.");
    }
    date = parseLogDate(getValue(formData, "date"));
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid time entry.",
    };
  }

  const note = getValue(formData, "note");

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      title: true,
      teamId: true,
      assignedToId: true,
      reopenCount: true,
    },
  });

  if (!task) {
    return { error: "Task not found." };
  }

  if (!(await canLogTaskTime(sessionUser.id, sessionUser.role, task))) {
    return { error: "You cannot log time on this task." };
  }

  // Once a task has been sent back, the note stops being optional: rework that
  // does not say what it was for is unaccountable hours on the reopen report.
  if (isOnReopenCycle(task.reopenCount) && !note) {
    return { error: "Add a note describing the reopened work." };
  }

  try {
    await prisma.taskTimeLog.create({
      data: {
        taskId,
        userId: sessionUser.id,
        minutes,
        date,
        // Stamped with the cycle the task is on now, which is what keeps reopen
        // hours separable from the original run for good.
        reopenCycle: task.reopenCount,
        note: note || null,
      },
    });

    await logActivity({
      userId: sessionUser.id,
      action: "logged",
      entityType: "task",
      entityId: taskId,
      description: isOnReopenCycle(task.reopenCount)
        ? `Logged ${formatDuration(minutes)} on task ${task.title} (reopen ${task.reopenCount})`
        : `Logged ${formatDuration(minutes)} on task ${task.title}`,
    });
  } catch {
    return { error: "Could not save the time entry. Please try again." };
  }

  revalidatePath("/tasks");
  revalidatePath("/reports");
  revalidatePath("/");

  return { ok: true };
}
