"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import LogTimeDialog from "@/components/tasks/LogTimeDialog";
import { formatDuration } from "@/lib/duration";
import { canMoveTo, type TaskStatus } from "@/lib/taskStatus";
import { updateOwnTaskStatus } from "@/app/tasks/actions";
import type { BoardCard, BoardColumn, BoardStatus } from "@/lib/taskBoard";

type TaskBoardProps = {
  heading: string;
  /** One line saying whose tasks these are, since the board itself cannot. */
  description: string;
  columns: BoardColumn[];
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
};

/**
 * The task the log time dialog is open for. `completing` means the entry was
 * asked for by a drop on Completed, and saving it moves the card there.
 */
type TimePrompt = DragCard & { completing: boolean };

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

/**
 * Avatar tints, picked by name rather than at random so the same person keeps
 * the same colour from one render to the next.
 */
const AVATAR_TINTS = [
  "bg-[#770FC2]",
  "bg-rose-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-indigo-500",
];

function tintFor(name: string) {
  let sum = 0;

  for (let index = 0; index < name.length; index += 1) {
    sum += name.charCodeAt(index);
  }

  return AVATAR_TINTS[sum % AVATAR_TINTS.length];
}

/** "Mubarak Ali" -> "MA", "Yaseen" -> "YA". */
function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  const letters =
    parts.length === 1
      ? parts[0].slice(0, 2)
      : `${parts[0][0]}${parts[parts.length - 1][0]}`;

  return letters.toUpperCase();
}

function Avatar({ name }: { name: string | null }) {
  if (!name) {
    return (
      <span
        title="Unassigned"
        className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-slate-300 text-[10px] font-semibold text-slate-400"
      >
        --
      </span>
    );
  }

  return (
    <span
      title={name}
      className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white ${tintFor(name)}`}
    >
      {initialsOf(name)}
    </span>
  );
}

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
  action,
}: {
  card: BoardCard;
  edge: string;
  moving: boolean;
  onDragStart: (event: React.DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  /**
   * The button along the foot of the card: Close on completed work. Absent on
   * every other column -- rework time is logged when the card is dragged back
   * to Completed, or from Task Management.
   */
  action?: { label: string; onClick: () => void };
}) {
  return (
    <article
      draggable={!moving}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`rounded-md border border-slate-200 border-l-4 bg-white p-3 shadow-sm transition ${edge} ${
        moving ? "opacity-50" : "cursor-grab active:cursor-grabbing"
      }`}
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

      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          disabled={moving}
          className="mt-3 w-full rounded-md border border-[#A05DD0]/45 bg-[#F8F7FB] px-3 py-1.5 text-xs font-medium text-[#770FC2] transition hover:border-[#A05DD0] hover:bg-[#F3E8FF] disabled:opacity-60"
        >
          {action.label}
        </button>
      ) : null}
    </article>
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
  function canDropOn(target: BoardStatus, source: BoardStatus) {
    return source !== target && canMoveTo(source, target);
  }

  function handleDragStart(card: BoardCard, status: BoardStatus) {
    return (event: React.DragEvent<HTMLElement>) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", card.id);
      setError(null);
      setDragCard({
        id: card.id,
        title: card.title,
        status,
        reopenCount: card.reopenCount,
      });
    };
  }

  function handleDragOver(target: BoardStatus) {
    return (event: React.DragEvent<HTMLDivElement>) => {
      if (!dragCard || !canDropOn(target, dragCard.status)) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    };
  }

  function handleDrop(target: BoardStatus) {
    return (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const source = dragCard;
      setDragCard(null);

      if (!source || !canDropOn(target, source.status)) {
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

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((column) => {
          const accent = COLUMN_ACCENT[column.status];
          const isValidTarget = Boolean(
            dragCard && canDropOn(column.status, dragCard.status)
          );

          return (
            <div
              key={column.status}
              onDragOver={handleDragOver(column.status)}
              onDrop={handleDrop(column.status)}
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
                      onDragStart={handleDragStart(card, column.status)}
                      onDragEnd={() => setDragCard(null)}
                      action={
                        column.status === "completed"
                          ? {
                              label: "Close",
                              onClick: () =>
                                setClosePrompt({
                                  id: card.id,
                                  title: card.title,
                                  status: column.status,
                                  reopenCount: card.reopenCount,
                                }),
                            }
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

      {reopenPrompt ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reopen-prompt-heading"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl">
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
          </div>
        </div>
      ) : null}

      {closePrompt ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="close-prompt-heading"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl">
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
          </div>
        </div>
      ) : null}

      {timePrompt ? (
        <LogTimeDialog
          key={`${timePrompt.id}-${timePrompt.completing}`}
          taskId={timePrompt.id}
          taskTitle={timePrompt.title}
          today={today}
          reopenCount={timePrompt.reopenCount}
          open
          onClose={() => setTimePrompt(null)}
          onSaved={handleTimeSaved}
          completing={timePrompt.completing}
        />
      ) : null}
    </section>
  );
}
