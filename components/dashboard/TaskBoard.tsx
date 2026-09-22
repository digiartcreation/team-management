import Link from "next/link";
import { formatDuration } from "@/lib/duration";
import type { BoardCard, BoardColumn, BoardStatus } from "@/lib/taskBoard";

type TaskBoardProps = {
  heading: string;
  /** One line saying whose tasks these are, since the board itself cannot. */
  description: string;
  columns: BoardColumn[];
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

function Card({ card, edge }: { card: BoardCard; edge: string }) {
  return (
    <article
      className={`rounded-md border border-slate-200 border-l-4 bg-white p-3 shadow-sm ${edge}`}
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
    </article>
  );
}

export default function TaskBoard({
  heading,
  description,
  columns,
}: TaskBoardProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{heading}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <Link
          href="/tasks"
          className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
        >
          View all
        </Link>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((column) => {
          const accent = COLUMN_ACCENT[column.status];

          return (
            <div
              key={column.status}
              className="rounded-lg border border-slate-200 bg-slate-50/70 p-3"
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

              <div className="mt-3 flex max-h-[28rem] flex-col gap-3 overflow-y-auto">
                {column.cards.length === 0 ? (
                  <p className="rounded-md border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">
                    Nothing here
                  </p>
                ) : (
                  column.cards.map((card) => (
                    <Card key={card.id} card={card} edge={accent.edge} />
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
    </section>
  );
}
