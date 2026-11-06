"use client";

import { useTransition } from "react";
import { deleteTask } from "@/app/tasks/actions";

type DeleteTaskButtonProps = {
  taskId: string;
};

export default function DeleteTaskButton({ taskId }: DeleteTaskButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this task?"
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      await deleteTask(taskId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className="rounded px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-60"
    >
      {isPending ? "Deleting..." : "Delete"}
    </button>
  );
}
