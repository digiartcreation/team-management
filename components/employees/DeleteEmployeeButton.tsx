"use client";

import { useTransition } from "react";
import { deleteEmployee } from "@/app/employees/actions";

type DeleteEmployeeButtonProps = {
  employeeId: string;
};

export default function DeleteEmployeeButton({
  employeeId,
}: DeleteEmployeeButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this employee?"
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      await deleteEmployee(employeeId);
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
