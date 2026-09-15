"use client";

import { FormEvent, useState, useTransition } from "react";
import LogTimeDialog from "@/components/tasks/LogTimeDialog";
import { updateOwnTaskStatus } from "@/app/tasks/actions";

type TaskStatusControlProps = {
  taskId: string;
  taskTitle: string;
  today: string;
  status: string;
  hasLoggedTime: boolean;
};

const statusOptions = ["pending", "in_progress", "completed"];

function formatLabel(value: string) {
  return value
    .replace("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function TaskStatusControl({
  taskId,
  taskTitle,
  today,
  status,
  hasLoggedTime,
}: TaskStatusControlProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [, startTransition] = useTransition();

  function openTimeDialog(forCompletion: boolean) {
    setCompleting(forCompletion);
    setDialogOpen(true);
  }

  function handleStatusSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const nextStatus = new FormData(form).get("status");

    if (nextStatus === "completed" && status !== "completed" && !hasLoggedTime) {
      event.preventDefault();
      openTimeDialog(true);
    }
  }

  function handleTimeSaved() {
    setDialogOpen(false);

    if (completing) {
      const formData = new FormData();
      formData.set("id", taskId);
      formData.set("status", "completed");
      startTransition(() => {
        void updateOwnTaskStatus(formData);
      });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => openTimeDialog(false)}
        className="flex w-full items-center gap-2 rounded-md border border-[#A05DD0]/45 bg-[#F8F7FB] px-3 py-2 text-left text-sm font-medium text-[#770FC2] transition hover:border-[#A05DD0] hover:bg-[#F3E8FF]"
      >
        Log time
      </button>

      <form
        action={updateOwnTaskStatus}
        onSubmit={handleStatusSubmit}
        className="grid gap-2"
      >
        <input type="hidden" name="id" value={taskId} />
        <select
          name="status"
          defaultValue={status}
          aria-label="Task status"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {formatLabel(option)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="w-full rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Update status
        </button>
      </form>

      <LogTimeDialog
        taskId={taskId}
        taskTitle={taskTitle}
        today={today}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={handleTimeSaved}
        completing={completing}
      />
    </>
  );
}
