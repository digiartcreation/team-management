"use client";

import { useTransition } from "react";
import { deleteTeam } from "@/app/teams/actions";

type DeleteTeamButtonProps = {
  teamId: string;
};

export default function DeleteTeamButton({ teamId }: DeleteTeamButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this team?"
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      await deleteTeam(teamId);
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
