"use client";

import { useState, useTransition } from "react";
import { deleteDocumentation } from "@/app/documentation/actions";

/** Deletes the page being read; the action then lands back on the list. */
export default function DeleteDocumentationButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!window.confirm("Are you sure you want to delete this page?")) {
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await deleteDocumentation(id);
      } catch (deleteError) {
        setError(
          deleteError instanceof Error
            ? deleteError.message
            : "Could not delete the page."
        );
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="inline-flex items-center justify-center rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
      >
        {isPending ? "Deleting..." : "Delete"}
      </button>
      {error ? (
        <p role="alert" className="w-full text-sm text-red-600 sm:text-right">
          {error}
        </p>
      ) : null}
    </>
  );
}
