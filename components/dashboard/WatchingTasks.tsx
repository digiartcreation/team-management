"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import LogTimeDialog from "@/components/tasks/LogTimeDialog";
import Avatar from "@/components/ui/Avatar";
import { formatDuration } from "@/lib/duration";
import type { WatchedCard } from "@/lib/taskBoard";

type WatchingTasksProps = {
  cards: WatchedCard[];
  /** Today as "YYYY-MM-DD", for the log time dialog. */
  today: string;
};

const STATUS_CHIP: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700",
  in_progress: "bg-amber-50 text-amber-700",
  reopened: "bg-[#F3E8FF] text-[#770FC2]",
  completed: "bg-emerald-50 text-emerald-700",
};

const PRIORITY_CHIP: Record<string, string> = {
  high: "bg-red-50 text-red-600",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-slate-100 text-slate-600",
};

/**
 * Tasks the signed-in person watches but is not assigned to. Kept apart from
 * their own board on purpose: they can log time here, but the task's status is
 * the assignee's to move, so there is nothing to drag.
 */
export default function WatchingTasks({ cards, today }: WatchingTasksProps) {
  const router = useRouter();
  const [logFor, setLogFor] = useState<WatchedCard | null>(null);

  // Stable, because the dialog runs it from an effect once the entry saves.
  const handleSaved = useCallback(() => {
    setLogFor(null);
    router.refresh();
  }, [router]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Watching</h2>
          <p className="mt-1 text-sm text-slate-500">
            Tasks you were added to as a watcher. Log the time you spend on
            them here.
          </p>
        </div>
        <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
          {cards.length} {cards.length === 1 ? "task" : "tasks"}
        </span>
      </div>

      {cards.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
          You are not watching any open tasks.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <article
              key={card.id}
              className="flex flex-col rounded-md border border-l-4 border-slate-200 border-l-sky-400 bg-white p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="break-words text-sm font-medium leading-snug text-slate-950">
                  {card.title}
                </h3>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${
                    STATUS_CHIP[card.status] ?? STATUS_CHIP.pending
                  }`}
                >
                  {card.statusLabel}
                </span>
              </div>

              {card.clientWork ? (
                <p className="mt-2 inline-block max-w-full self-start truncate rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700">
                  {card.clientWork}
                </p>
              ) : null}

              <p className="mt-2 truncate text-xs text-slate-500">
                {card.clientName ?? "Internal"}
              </p>

              <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <Avatar name={card.assigneeName} />
                <span className="min-w-0 truncate">
                  {card.assigneeName
                    ? `Assigned to ${card.assigneeName}`
                    : "Unassigned"}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-medium capitalize ${
                    PRIORITY_CHIP[card.priority] ?? PRIORITY_CHIP.low
                  }`}
                >
                  {card.priority}
                </span>
                <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] leading-none text-slate-600">
                  {card.minutes > 0 ? `Log ${formatDuration(card.minutes)}` : "No log"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setLogFor(card)}
                className="mt-3 w-full rounded-md border border-[#A05DD0]/45 bg-[#F8F7FB] px-3 py-1.5 text-xs font-medium text-[#770FC2] transition hover:border-[#A05DD0] hover:bg-[#F3E8FF]"
              >
                Log time
              </button>
            </article>
          ))}
        </div>
      )}

      {logFor ? (
        <LogTimeDialog
          key={logFor.id}
          taskId={logFor.id}
          taskTitle={logFor.title}
          today={today}
          reopenCount={logFor.reopenCount}
          open
          onClose={() => setLogFor(null)}
          onSaved={handleSaved}
          completing={false}
          savedLogs={logFor.timeLogs}
        />
      ) : null}
    </section>
  );
}
