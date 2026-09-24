"use client";

import { useState, useTransition } from "react";
import LogTimeDialog from "@/components/tasks/LogTimeDialog";
import { useActionMenu } from "@/components/ui/ActionMenu";
import { updateOwnTaskStatus } from "@/app/tasks/actions";
import { TASK_STATUS_OPTIONS, allowedNextStatuses } from "@/lib/taskStatus";

type TaskStatusControlProps = {
  taskId: string;
  taskTitle: string;
  today: string;
  status: string;
  /** How many times the task has already been sent back. */
  reopenCount: number;
};

function formDataFor(taskId: string, status: string, reopenReason?: string) {
  const formData = new FormData();
  formData.set("id", taskId);
  formData.set("status", status);

  if (reopenReason) {
    formData.set("reopenReason", reopenReason);
  }

  return formData;
}

export default function TaskStatusControl({
  taskId,
  taskTitle,
  today,
  status,
  reopenCount,
}: TaskStatusControlProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [reopenReason, setReopenReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const menu = useActionMenu();

  // Only the moves this task may make: finished work can be reopened or
  // closed, never dropped back into Backlog or In Progress.
  const allowed = new Set<string>(allowedNextStatuses(status));
  const statusOptions = TASK_STATUS_OPTIONS.filter((option) =>
    allowed.has(option.value)
  );
  const reopening = selectedStatus === "reopened" && status !== "reopened";
  const closing = selectedStatus === "closed" && status !== "closed";
  const canLogWithoutChange =
    selectedStatus === status &&
    (status === "completed" || status === "reopened");

  function openTimeDialog(forCompletion: boolean) {
    setCompleting(forCompletion);
    setDialogOpen(true);
  }

  // Called rather than handed to the form's action so the menu can be closed
  // once the update has actually landed, instead of vanishing while it is still
  // in flight.
  function updateStatus(next: string, reason?: string) {
    startTransition(async () => {
      await updateOwnTaskStatus(formDataFor(taskId, next, reason));
      menu?.close();
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      closing &&
      !window.confirm(
        `Are you sure you want to close "${taskTitle}"? It will leave the dashboard and only show in Task Management.`
      )
    ) {
      return;
    }

    updateStatus(selectedStatus, reopening ? reopenReason : undefined);
  }

  function handleTimeSaved() {
    setDialogOpen(false);

    if (completing) {
      setCompleting(false);
      updateStatus("completed");
      return;
    }

    // A plain entry changes nothing about the status, so there is no update to
    // wait on before getting the panel out of the way.
    menu?.close();
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="grid gap-2">
        {reopenCount > 0 ? (
          <p className="rounded-md border border-[#A05DD0]/45 bg-[#F8F7FB] px-3 py-2 text-xs font-medium text-[#770FC2]">
            Reopened {reopenCount} {reopenCount === 1 ? "time" : "times"}
          </p>
        ) : null}

        <select
          name="status"
          value={selectedStatus}
          onChange={(event) => setSelectedStatus(event.target.value)}
          aria-label="Task status"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {reopening ? (
          <label className="grid gap-1">
            <span className="text-xs font-medium uppercase tracking-normal text-slate-500">
              Reason (optional)
            </span>
            <textarea
              value={reopenReason}
              onChange={(event) => setReopenReason(event.target.value)}
              rows={2}
              placeholder="Eg: client asked for a different thumbnail"
              className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        ) : null}

        {selectedStatus === "completed" && status !== "completed" ? (
          <button
            type="button"
            onClick={() => openTimeDialog(true)}
            className="w-full rounded-md bg-[#770FC2] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#6B1BBD]"
          >
            Log time &amp; complete
          </button>
        ) : (
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {isPending
              ? "Updating..."
              : reopening
                ? "Reopen task"
                : closing
                  ? "Close task"
                  : "Update status"}
          </button>
        )}
      </form>

      {canLogWithoutChange ? (
        <button
          type="button"
          onClick={() => openTimeDialog(false)}
          className="flex w-full items-center gap-2 rounded-md border border-[#A05DD0]/45 bg-[#F8F7FB] px-3 py-2 text-left text-sm font-medium text-[#770FC2] transition hover:border-[#A05DD0] hover:bg-[#F3E8FF]"
        >
          Log time
        </button>
      ) : null}

      <LogTimeDialog
        taskId={taskId}
        taskTitle={taskTitle}
        today={today}
        reopenCount={reopenCount}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={handleTimeSaved}
        completing={completing}
      />
    </>
  );
}
