"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import LogTimeDialog from "@/components/tasks/LogTimeDialog";
import Avatar from "@/components/ui/Avatar";
import { formatDuration } from "@/lib/duration";
import { formatOfficeDate } from "@/lib/officeTime";
import {
  COMPLETED_STALE_DAYS,
  canMoveTo,
  type TaskStatus,
} from "@/lib/taskStatus";
import { updateOwnTaskStatus } from "@/app/tasks/actions";
import type {
  BoardCard,
  BoardColumn,
  BoardGroup,
  BoardStatus,
  BoardTimeLog,
} from "@/lib/taskBoard";

type TaskBoardProps = {
  heading: string;
  /** One line saying whose tasks these are, since the board itself cannot. */
  description: string;
  /**
   * One board's columns. Pass `groups` instead to show a separate board per
   * person, as the admin dashboard does.
   */
  columns?: BoardColumn[];
  groups?: BoardGroup[];
  /** Today as "YYYY-MM-DD", for the log time dialog. */
  today: string;
  /** The dashboard the board sits on, so an added task comes back to it. */
  dashboardPath: "/" | "/manager" | "/member";
};

/** The card currently being dragged, and the column it started in. */
type DragCard = {
  id: string;
  title: string;
  status: BoardStatus;
  reopenCount: number;
  /**
   * The board the card belongs to. A card only drops within its own board:
   * dragging onto someone else's would read as reassigning it, which a status
   * move does not do.
   */
  group: string;
};

/** The key a single, ungrouped board uses. */
const SINGLE_BOARD = "board";

/**
 * The task the log time dialog is open for. `completing` means the entry was
 * asked for by a drop on Completed, and saving it moves the card there.
 * `timeOnly` is the quick entry from a completed card's Log time button.
 */
type TimePrompt = DragCard & {
  completing: boolean;
  timeOnly?: boolean;
  logs?: BoardTimeLog[];
};

/** The dot beside a column heading, and the tint of its cards' left edge. */
const COLUMN_ACCENT: Record<BoardStatus, { dot: string; edge: string }> = {
  pending: { dot: "bg-slate-400", edge: "border-l-slate-300" },
  in_progress: { dot: "bg-amber-500", edge: "border-l-amber-400" },
  reopened: { dot: "bg-[#770FC2]", edge: "border-l-[#A05DD0]" },
  completed: { dot: "bg-emerald-500", edge: "border-l-emerald-400" },
};

const PRIORITY_CHIP: Record<string, string> = {
  high: "bg-red-50 text-red-600",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-slate-100 text-slate-600",
};

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "brand";
}) {
  return (
    <span
      className={`rounded border px-1.5 py-0.5 font-mono text-[11px] leading-none ${
        tone === "brand"
          ? "border-[#A05DD0]/45 bg-[#F8F7FB] text-[#770FC2]"
          : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {children}
    </span>
  );
}

function Card({
  card,
  edge,
  moving,
  onDragStart,
  onDragEnd,
  showCompletedAt = false,
  actions = [],
}: {
  card: BoardCard;
  edge: string;
  moving: boolean;
  onDragStart: (event: React.DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  /** The first completion date, shown on the Completed column only. */
  showCompletedAt?: boolean;
  /**
   * The buttons along the foot of the card: Log time and Close on completed
   * work. None on the other columns -- their time is logged when the card is
   * dragged to Completed, or from Task Management.
   */
  actions?: { label: string; onClick: () => void }[];
}) {
  return (
    <article
      draggable={!moving}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`rounded-md border border-l-4 bg-white p-3 shadow-sm transition ${
        // Completed for too long without being closed: outlined in red.
        card.completedStale
          ? "border-red-500 ring-1 ring-red-200"
          : `border-slate-200 ${edge}`
      } ${moving ? "opacity-50" : "cursor-grab active:cursor-grabbing"}`}
    >
      <h3 className="break-words text-sm font-medium leading-snug text-slate-950">
        {card.title}
      </h3>

      {card.clientWork ? (
        <p className="mt-2 inline-block max-w-full truncate rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700">
          {card.clientWork}
        </p>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-slate-500">
          {card.clientName ?? "Internal"}
        </span>
        <Avatar name={card.assigneeName} />
      </div>

      {showCompletedAt && card.completedAt ? (
        <p
          className={`mt-1 text-[11px] ${
            card.completedStale ? "font-medium text-red-600" : "text-emerald-700"
          }`}
        >
          Completed {formatOfficeDate(card.completedAt)}
          {card.completedStale
            ? ` · over ${COMPLETED_STALE_DAYS} days, close it`
            : null}
        </p>
      ) : null}

      {card.latestReopenNote ? (
        <p className="mt-2 break-words border-l-2 border-[#A05DD0]/50 pl-2 text-[11px] italic leading-snug text-slate-500">
          {card.latestReopenNote}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium capitalize ${
            PRIORITY_CHIP[card.priority] ?? PRIORITY_CHIP.low
          }`}
        >
          {card.priority}
        </span>
        <Badge>
          {card.minutes > 0 ? `Log ${formatDuration(card.minutes)}` : "No log"}
        </Badge>
        {card.reopenCount > 0 ? (
          <Badge tone="brand">Reopened {card.reopenCount}x</Badge>
        ) : null}
        {card.reopenMinutes > 0 ? (
          <Badge tone="brand">
            Rework {formatDuration(card.reopenMinutes)}
          </Badge>
        ) : null}
      </div>

      {actions.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              disabled={moving}
              className="w-full rounded-md border border-[#A05DD0]/45 bg-[#F8F7FB] px-3 py-1.5 text-xs font-medium text-[#770FC2] transition hover:border-[#A05DD0] hover:bg-[#F3E8FF] disabled:opacity-60"
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

/**
 * A confirmation in the browser's top layer, like the log time dialog, so it
 * opens over whatever part of the page is on screen. A fixed overlay would be
 * pinned to the board instead: the board lifts on hover with a transform, and
 * a transformed parent holds its fixed children, centring the prompt on the
 * whole board -- often off screen.
 */
function PromptDialog({
  labelledBy,
  onClose,
  children,
}: {
  labelledBy: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby={labelledBy}
      className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-lg border border-slate-200 bg-white p-6 text-left shadow-xl backdrop:bg-slate-950/40"
    >
      {children}
    </dialog>
  );
}

function statusFormData(id: string, status: TaskStatus, reopenReason?: string) {
  const formData = new FormData();
  formData.set("id", id);
  formData.set("status", status);

  if (reopenReason) {
    formData.set("reopenReason", reopenReason);
  }

  return formData;
}

export default function TaskBoard({
  heading,
  description,
  columns,
  groups,
  today,
  dashboardPath,
}: TaskBoardProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dragCard, setDragCard] = useState<DragCard | null>(null);
  const [movingCardId, setMovingCardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reopenPrompt, setReopenPrompt] = useState<DragCard | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [closePrompt, setClosePrompt] = useState<DragCard | null>(null);
  const [timePrompt, setTimePrompt] = useState<TimePrompt | null>(null);
  // Read by the save handler, which has to stay stable for the dialog's effect.
  const timePromptRef = useRef<TimePrompt | null>(null);
  timePromptRef.current = timePrompt;

  function submitStatus(id: string, status: TaskStatus, reopenReason?: string) {
    setError(null);
    setMovingCardId(id);

    startTransition(async () => {
      try {
        await updateOwnTaskStatus(statusFormData(id, status, reopenReason));
        router.refresh();
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Could not update the task's status."
        );
      } finally {
        setMovingCardId(null);
      }
    });
  }

  // Same rules as the status picker: finished work only goes to Reopened.
  function canDropOn(target: BoardStatus, group: string, source: DragCard) {
    return (
      source.group === group &&
      source.status !== target &&
      canMoveTo(source.status, target)
    );
  }

  function handleDragStart(card: BoardCard, status: BoardStatus, group: string) {
    return (event: React.DragEvent<HTMLElement>) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", card.id);
      setError(null);
      setDragCard({
        id: card.id,
        title: card.title,
        status,
        reopenCount: card.reopenCount,
        group,
      });
    };
  }

  function handleDragOver(target: BoardStatus, group: string) {
    return (event: React.DragEvent<HTMLDivElement>) => {
      if (!dragCard || !canDropOn(target, group, dragCard)) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    };
  }

  function handleDrop(target: BoardStatus, group: string) {
    return (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const source = dragCard;
      setDragCard(null);

      if (!source || !canDropOn(target, group, source)) {
        return;
      }

      if (target === "reopened") {
        setReopenReason("");
        setReopenPrompt(source);
        return;
      }

      // Same rule as the Tasks page: a task is only called finished with an
      // entry saying how long it took.
      if (target === "completed") {
        setTimePrompt({ ...source, completing: true });
        return;
      }

      submitStatus(source.id, target);
    };
  }

  function confirmReopen() {
    if (!reopenPrompt) {
      return;
    }

    submitStatus(reopenPrompt.id, "reopened", reopenReason.trim() || undefined);
    setReopenPrompt(null);
  }

  function confirmClose() {
    if (!closePrompt) {
      return;
    }

    submitStatus(closePrompt.id, "closed");
    setClosePrompt(null);
  }

  const handleTimeSaved = useCallback(() => {
    const prompt = timePromptRef.current;
    setTimePrompt(null);

    if (prompt?.completing) {
      submitStatus(prompt.id, "completed");
    } else {
      router.refresh();
    }
    // submitStatus only touches state setters and the router.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function renderColumns(group: string, boardColumns: BoardColumn[]) {
    return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {boardColumns.map((column) => {
            const accent = COLUMN_ACCENT[column.status];
            const isValidTarget = Boolean(
              dragCard && canDropOn(column.status, group, dragCard)
            );

            return (
              <div
                key={column.status}
                onDragOver={handleDragOver(column.status, group)}
                onDrop={handleDrop(column.status, group)}
                className={`rounded-lg border p-3 transition ${
                  isValidTarget
                    ? "border-[#A05DD0] bg-[#F8F7FB] ring-2 ring-[#A05DD0]/40"
                    : "border-slate-200 bg-slate-50/70"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className={`h-2 w-2 shrink-0 rounded-full ${accent.dot}`}
                    />
                    <span className="truncate text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {column.label}
                    </span>
                  </span>
                  <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-xs font-medium text-slate-500 shadow-sm">
                    {column.total}
                  </span>
                </div>

                {/* Grows with its cards, so every card in the column is in view. */}
                <div className="mt-3 flex flex-col gap-3">
                  {column.cards.length === 0 ? (
                    <p className="rounded-md border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">
                      Nothing here
                    </p>
                  ) : (
                    column.cards.map((card) => (
                      <Card
                        key={card.id}
                        card={card}
                        edge={accent.edge}
                        moving={movingCardId === card.id}
                        onDragStart={handleDragStart(card, column.status, group)}
                        onDragEnd={() => setDragCard(null)}
                        showCompletedAt={column.status === "completed"}
                        actions={
                          column.status === "completed"
                            ? [
                                {
                                  label: "Log time",
                                  onClick: () =>
                                    setTimePrompt({
                                      id: card.id,
                                      title: card.title,
                                      status: column.status,
                                      reopenCount: card.reopenCount,
                                      group,
                                      completing: false,
                                      timeOnly: true,
                                      logs: card.timeLogs,
                                    }),
                                },
                                {
                                  label: "Close",
                                  onClick: () =>
                                    setClosePrompt({
                                      id: card.id,
                                      title: card.title,
                                      status: column.status,
                                      reopenCount: card.reopenCount,
                                      group,
                                    }),
                                },
                              ]
                            : undefined
                        }
                      />
                    ))
                  )}
                </div>

                {column.total > column.cards.length ? (
                  <p className="mt-3 text-center text-xs text-slate-400">
                    Showing {column.cards.length} of {column.total}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{heading}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/tasks"
            className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
          >
            View all
          </Link>
          <Link
            href={`/tasks/new?from=${encodeURIComponent(dashboardPath)}`}
            className="inline-flex items-center justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Add Task
          </Link>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0 font-medium text-red-700 hover:text-red-900"
          >
            Dismiss
          </button>
        </p>
      ) : null}

      {groups ? (
        <div className="mt-4 flex flex-col gap-4">
          {groups.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
              No employees yet.
            </p>
          ) : (
            groups.map((group) => (
              // Empty boards start folded, so the people with work lead.
              <details
                key={group.key}
                open={group.taskCount > 0}
                className="group rounded-lg border border-slate-200 bg-white"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar name={group.name} />
                    <span className="truncate text-sm font-semibold text-slate-900">
                      {group.name ?? "Unassigned"}
                    </span>
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
                      {group.taskCount} {group.taskCount === 1 ? "task" : "tasks"}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="shrink-0 -rotate-90 text-xs text-slate-400 transition group-open:rotate-0"
                  >
                    &#9660;
                  </span>
                </summary>
                <div className="border-t border-slate-100 p-3">
                  {renderColumns(group.key, group.columns)}
                </div>
              </details>
            ))
          )}
        </div>
      ) : (
        <div className="mt-4">{renderColumns(SINGLE_BOARD, columns ?? [])}</div>
      )}

      {reopenPrompt ? (
        <PromptDialog
          labelledBy="reopen-prompt-heading"
          onClose={() => setReopenPrompt(null)}
        >
          <h2
            id="reopen-prompt-heading"
            className="text-lg font-semibold text-slate-950"
          >
            Reopen task
          </h2>
          <p className="mt-1 break-words text-sm text-slate-500">
            {reopenPrompt.title}
          </p>

          <label className="mt-4 grid gap-1">
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

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setReopenPrompt(null)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmReopen}
              className="rounded-md bg-[#770FC2] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#6B1BBD]"
            >
              Reopen task
            </button>
          </div>
        </PromptDialog>
      ) : null}

      {closePrompt ? (
        <PromptDialog
          labelledBy="close-prompt-heading"
          onClose={() => setClosePrompt(null)}
        >
          <h2
            id="close-prompt-heading"
            className="text-lg font-semibold text-slate-950"
          >
            Close task
          </h2>
          <p className="mt-1 break-words text-sm text-slate-500">
            {closePrompt.title}
          </p>
          <p className="mt-4 text-sm text-slate-700">
            Are you sure you want to close this task? It will leave the
            dashboard and only show in Task Management.
          </p>

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setClosePrompt(null)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              No
            </button>
            <button
              type="button"
              onClick={confirmClose}
              className="rounded-md bg-[#770FC2] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#6B1BBD]"
            >
              Yes, close
            </button>
          </div>
        </PromptDialog>
      ) : null}

      {timePrompt ? (
        <LogTimeDialog
          key={`${timePrompt.id}-${timePrompt.completing}-${timePrompt.timeOnly ?? false}`}
          taskId={timePrompt.id}
          taskTitle={timePrompt.title}
          today={today}
          reopenCount={timePrompt.reopenCount}
          open
          onClose={() => setTimePrompt(null)}
          onSaved={handleTimeSaved}
          completing={timePrompt.completing}
          timeOnly={timePrompt.timeOnly}
          savedLogs={timePrompt.logs}
        />
      ) : null}
    </section>
  );
}
