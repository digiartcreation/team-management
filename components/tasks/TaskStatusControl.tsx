"use client";

import { useState, useTransition } from "react";
import LogTimeDialog from "@/components/tasks/LogTimeDialog";
import { updateOwnTaskStatus } from "@/app/tasks/actions";

type TaskStatusControlProps = {
  taskId: string;
  taskTitle: string;
  today: string;
  status: string;
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
}: TaskStatusControlProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [, startTransition] = useTransition();

  function openTimeDialog(forCompletion: boolean) {
    setCompleting(forCompletion);
    setDialogOpen(true);
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
      <form action={updateOwnTaskStatus} className="grid gap-2">
        <input type="hidden" name="id" value={taskId} />
        <select
          name="status"
          value={selectedStatus}
          onChange={(event) => setSelectedStatus(event.target.value)}
          aria-label="Task status"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {formatLabel(option)}
            </option>
          ))}
        </select>
        {selectedStatus === "completed" && status !== "completed" ? (
          <button
            type="button"
            onClick={() => openTimeDialog(true)}
            className="w-full rounded-md bg-[#770FC2] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#6B1BBD]"
          >
            Log time & complete
          </button>
        ) : (
          <button
            type="submit"
            className="w-full rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Update status
          </button>
        )}
      </form>

      {selectedStatus === "completed" && status === "completed" ? (
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
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={handleTimeSaved}
        completing={completing}
      />
    </>
  );
}
