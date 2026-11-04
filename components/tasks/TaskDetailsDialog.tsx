"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatDuration } from "@/lib/duration";
import type { TaskDetails } from "@/lib/taskDetails";

const STATUS_TONE: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700",
  in_progress: "bg-amber-50 text-amber-700",
  completed: "bg-emerald-50 text-emerald-700",
  reopened: "bg-[#F3E8FF] text-[#770FC2]",
  closed: "bg-slate-800 text-white",
};

const PRIORITY_TONE: Record<string, string> = {
  high: "bg-red-50 text-red-600",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-slate-100 text-slate-600",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-slate-800">{children}</dd>
    </div>
  );
}

const none = <span className="text-slate-400">None</span>;

/**
 * A task's full details -- description, people, client work, every time
 * entry and reopen -- loaded when it opens. In the browser's top layer, like
 * the board's other dialogs, so it sits over the page wherever it scrolled.
 */
export default function TaskDetailsDialog({
  taskId,
  onClose,
}: {
  taskId: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [task, setTask] = useState<TaskDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const headingId = `task-details-${taskId}`;

  useEffect(() => {
    const dialog = dialogRef.current;

    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/tasks/${taskId}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? "This task is not there any more, or is not yours to see."
              : "Could not load the task. Please try again."
          );
        }

        const body = (await response.json()) as { task: TaskDetails };

        if (!cancelled) {
          setTask(body.task);
        }
      })
      .catch((loadError: Error) => {
        if (!cancelled) {
          setError(loadError.message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby={headingId}
      // A click on the backdrop lands on the dialog itself: close.
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          dialogRef.current?.close();
        }
      }}
      className="m-auto max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-left shadow-2xl backdrop:bg-slate-950/50"
    >
      <div className="flex max-h-[90dvh] flex-col">
        <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            {task ? (
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[task.status] ?? STATUS_TONE.pending}`}>
                  {task.statusLabel}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${PRIORITY_TONE[task.priority] ?? PRIORITY_TONE.low}`}>
                  {task.priority} priority
                </span>
                {task.reopenCount > 0 ? (
                  <span className="rounded-full border border-[#A05DD0]/45 bg-[#F8F7FB] px-2.5 py-0.5 text-xs font-medium text-[#770FC2]">
                    Reopened {task.reopenCount}x
                  </span>
                ) : null}
              </div>
            ) : null}
            <h2 id={headingId} className="break-words text-lg font-semibold leading-snug text-slate-950 sm:text-xl">
              {task?.title ?? (error ? "Task" : "Loading task...")}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
            className="-mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-[#F3E8FF] hover:text-[#770FC2]"
          >
            <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {error ? (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : !task ? (
            <div className="grid gap-3" aria-hidden>
              {[70, 90, 55, 80].map((width) => (
                <div key={width} className="h-3.5 animate-pulse rounded bg-slate-100" style={{ width: `${width}%` }} />
              ))}
            </div>
          ) : (
            <div className="grid gap-6">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-slate-100 bg-slate-50/60 p-4">
                <Field label="Assigned to">{task.assignee ?? "Unassigned"}</Field>
                <Field label="Team">{task.team ?? "No team"}</Field>
                <Field label="Client / Work">
                  {task.client ?? "Internal"}
                  {task.clientWork ? <span className="block text-xs text-slate-500">{task.clientWork}</span> : null}
                  {task.workDetail ? <span className="block text-xs font-medium text-[#770FC2]">{task.workDetail}</span> : null}
                </Field>
                <Field label="Watchers">{task.watchers.length > 0 ? task.watchers.join(", ") : none}</Field>
                <Field label="Created">
                  {task.createdOn}
                  {task.editedOn ? <span className="block text-xs text-slate-500">Edited {task.editedOn}</span> : null}
                </Field>
                <Field label="Completed">{task.completedOn ?? <span className="text-slate-400">Not yet</span>}</Field>
              </dl>

              <Section title="Description">
                {task.descriptionHtml ? (
                  <div
                    className="ck-content doc-content break-words rounded-lg border border-slate-200 px-4 py-3 text-sm"
                    // Sanitised on the server: lib/taskDescription.ts.
                    dangerouslySetInnerHTML={{ __html: task.descriptionHtml }}
                  />
                ) : (
                  <p className="text-sm text-slate-400">No description.</p>
                )}
              </Section>

              <Section title="Time spent">
                {task.logs.length === 0 ? (
                  <p className="text-sm text-slate-400">Nothing logged yet.</p>
                ) : (
                  <div className="grid gap-3">
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <span className="text-2xl font-semibold text-slate-950">{formatDuration(task.time.total)}</span>
                      {task.time.reopen > 0 ? (
                        <span className="text-xs text-slate-500">
                          First run {formatDuration(task.time.original)} · Rework{" "}
                          <span className="font-medium text-[#770FC2]">{formatDuration(task.time.reopen)}</span>
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {task.time.byPerson.map((person) => (
                        <span key={person.name} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">
                          {person.name} · {formatDuration(person.minutes)}
                        </span>
                      ))}
                    </div>
                    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                      {task.logs.map((log) => (
                        <li key={log.id} className="grid gap-0.5 px-3 py-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm text-slate-800">
                              {log.date}
                              {log.person ? <span className="text-slate-500"> · {log.person}</span> : null}
                            </span>
                            <span className="flex items-center gap-1.5">
                              {log.cycle > 0 ? (
                                <span className="rounded bg-[#F3E8FF] px-1.5 py-0.5 text-[11px] font-medium text-[#770FC2]">
                                  Reopen {log.cycle}
                                </span>
                              ) : null}
                              <span className="text-sm font-medium text-slate-900">{formatDuration(log.minutes)}</span>
                            </span>
                          </div>
                          {log.note ? (
                            <p className="whitespace-pre-line break-words text-xs text-slate-500">{log.note}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Section>

              {task.reopens.length > 0 ? (
                <Section title="Reopen history">
                  <ol className="grid gap-2">
                    {task.reopens.map((reopen) => (
                      <li key={reopen.cycle} className="rounded-lg border-l-2 border-[#A05DD0] bg-[#F8F7FB] px-3 py-2">
                        <p className="text-sm font-medium text-slate-900">
                          Reopen {reopen.cycle}
                          <span className="font-normal text-slate-500">
                            {[reopen.cause, reopen.by ? `by ${reopen.by}` : null, reopen.on].filter(Boolean).map((part) => ` · ${part}`)}
                          </span>
                        </p>
                        {reopen.reason ? (
                          <p className="mt-0.5 whitespace-pre-line break-words text-xs text-slate-600">{reopen.reason}</p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </Section>
              ) : null}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-slate-100 px-5 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Close
          </button>
          {task?.editHref ? (
            <Link
              href={task.editHref}
              className="rounded-md bg-[#770FC2] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#6B1BBD]"
            >
              Edit task
            </Link>
          ) : null}
        </footer>
      </div>
    </dialog>
  );
}

/**
 * Something to click that opens a task's details: the title in the Tasks
 * table, View details on a phone card.
 */
export function TaskDetailsButton({
  taskId,
  className,
  children,
}: {
  taskId: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      {open ? <TaskDetailsDialog taskId={taskId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
