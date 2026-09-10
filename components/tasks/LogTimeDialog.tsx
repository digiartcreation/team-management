"use client";

import { useActionState, useEffect, useRef } from "react";
import { logTaskTime, type LogTimeState } from "@/app/tasks/actions";

type LogTimeDialogProps = {
  taskId: string;
  taskTitle: string;
  /** Today as "YYYY-MM-DD": the default entry date, and the latest allowed. */
  today: string;
};

const fieldClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#770FC2] focus:ring-2 focus:ring-[#770FC2]/20";

const labelClass = "text-xs font-medium uppercase tracking-normal text-slate-500";

export default function LogTimeDialog({
  taskId,
  taskTitle,
  today,
}: LogTimeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<
    LogTimeState,
    FormData
  >(logTaskTime, null);

  // Close and clear once the entry saves, so the next open starts fresh.
  useEffect(() => {
    if (state && "ok" in state) {
      formRef.current?.reset();
      dialogRef.current?.close();
    }
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded px-3 py-2 text-left text-sm text-[#1F2937] transition hover:bg-[#F3E8FF] hover:text-[#770FC2]"
      >
        Log time
      </button>

      {/*
        A native dialog opened with showModal() renders in the browser's top
        layer, so it is not clipped by the table's overflow-x-auto container the
        way an absolutely positioned dropdown is.
      */}
      <dialog
        ref={dialogRef}
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
              Log time
            </h2>
            <p className="mt-1 break-words text-sm text-slate-500">
              {taskTitle}
            </p>
          </div>

          <fieldset className="grid gap-2">
            <legend className={labelClass}>Time spent</legend>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <input
                  name="hours"
                  type="number"
                  min="0"
                  max="24"
                  step="1"
                  placeholder="0"
                  aria-label="Hours spent"
                  className="w-20 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#770FC2] focus:ring-2 focus:ring-[#770FC2]/20"
                />
                <span className="text-sm text-slate-600">hours</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  name="minutes"
                  type="number"
                  min="0"
                  max="59"
                  step="1"
                  placeholder="0"
                  aria-label="Minutes spent"
                  className="w-20 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#770FC2] focus:ring-2 focus:ring-[#770FC2]/20"
                />
                <span className="text-sm text-slate-600">minutes</span>
              </div>
            </div>
          </fieldset>

          <label className="grid gap-2">
            <span className={labelClass}>Date of work</span>
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
            <span className={labelClass}>Note (optional)</span>
            <input
              name="note"
              type="text"
              placeholder="Eg: first cut and colour pass"
              className={fieldClass}
            />
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
              onClick={() => dialogRef.current?.close()}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-[#770FC2] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#6B1BBD] disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Save entry"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
