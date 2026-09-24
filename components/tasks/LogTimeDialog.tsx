"use client";

import { useActionState, useEffect, useRef } from "react";
import { logTaskTime, type LogTimeState } from "@/app/tasks/actions";
import { isOnReopenCycle } from "@/lib/taskStatus";

type LogTimeDialogProps = {
  taskId: string;
  taskTitle: string;
  /** Today as "YYYY-MM-DD": the default entry date, and the latest allowed. */
  today: string;
  /**
   * How many times the task has been reopened. Above zero the entry belongs to
   * a reopen cycle, which is what makes the note mandatory.
   */
  reopenCount: number;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  completing: boolean;
};

const fieldClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#770FC2] focus:ring-2 focus:ring-[#770FC2]/20";

const labelClass = "text-xs font-medium uppercase tracking-normal text-slate-500";

// 0 minutes to 8 hours in quarter hours. Zero is there on purpose: it lets a
// task be marked done when it took no measurable time.
const timeSpentOptions = Array.from({ length: 33 }, (_, index) => index * 15);

function formatTimeSpent(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${minutes} minutes`;
  }

  return remainingMinutes === 0
    ? `${hours} hour${hours === 1 ? "" : "s"}`
    : `${hours} hr ${remainingMinutes} minutes`;
}

export default function LogTimeDialog({
  taskId,
  taskTitle,
  today,
  reopenCount,
  open,
  onClose,
  onSaved,
  completing,
}: LogTimeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<
    LogTimeState,
    FormData
  >(logTaskTime, null);
  // Rework has to say what it was for, so on a reopened task the note is no
  // longer the optional afterthought it is on the original run.
  const onReopen = isOnReopenCycle(reopenCount);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (state && "ok" in state) {
      formRef.current?.reset();
      onSaved();
    }
  }, [state, onSaved]);

  return (
    <dialog
        ref={dialogRef}
        onClose={onClose}
        aria-labelledby={`log-time-heading-${taskId}`}
        className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-lg border border-slate-200 bg-white p-0 text-left shadow-xl backdrop:bg-slate-950/40"
      >
      <form ref={formRef} action={formAction} className="grid gap-5 p-6">
        <input type="hidden" name="taskId" value={taskId} />

        <div>
          <h2
            id={`log-time-heading-${taskId}`}
            className="text-lg font-semibold text-slate-950"
          >
            {onReopen
              ? completing
                ? "Log reopen time to complete"
                : "Log reopen time"
              : completing
                ? "Log time to complete"
                : "Log time"}
          </h2>
          <p className="mt-1 break-words text-sm text-slate-500">{taskTitle}</p>
          {onReopen ? (
            <p className="mt-2 rounded-md border border-[#A05DD0]/45 bg-[#F8F7FB] px-3 py-2 text-sm text-[#770FC2]">
              This task has been reopened {reopenCount}{" "}
              {reopenCount === 1 ? "time" : "times"}. Time saved here counts
              towards reopen {reopenCount} and is reported apart from the
              original run.
            </p>
          ) : completing ? (
            <p className="mt-2 text-sm text-slate-600">
              Nothing has been logged against this task yet. Saving this entry
              marks it completed.
            </p>
          ) : null}
        </div>

        <fieldset className="grid gap-2">
          <legend className={labelClass}>Time spent</legend>
          <select name="durationMinutes" required className={fieldClass} defaultValue="">
            <option value="" disabled>
              Select time spent
            </option>
            {timeSpentOptions.map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatTimeSpent(minutes)}
              </option>
            ))}
          </select>
        </fieldset>

        <label className="grid gap-2">
          <span className={labelClass}>Date Of Work Completion</span>
          <input
            name="date"
            type="date"
            defaultValue={today}
            max={today}
            required
            className={fieldClass}
          />
        </label>

        <label className="grid gap-2">
          <span className={labelClass}>
            {onReopen ? "Note (required)" : "Note (optional)"}
          </span>
          <input
            name="note"
            type="text"
            required={onReopen}
            placeholder={
              onReopen
                ? "Eg: re-export after client feedback"
                : "Eg: first cut and colour pass"
            }
            className={fieldClass}
          />
          {onReopen ? (
            <span className="text-xs text-slate-500">
              Say what the rework was for. Reopened hours are reported on their
              own, so they cannot go in unexplained.
            </span>
          ) : null}
        </label>

        {state && "error" in state ? (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {state.error}
          </p>
        ) : null}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-[#770FC2] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#6B1BBD] disabled:opacity-60"
          >
            {isPending
              ? "Saving..."
              : completing
                ? "Save and complete"
                : "Save entry"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
