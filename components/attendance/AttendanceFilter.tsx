"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export type AttendanceView = "today" | "week" | "month";

type Option = { value: string; label: string };

type AttendanceFilterProps = {
  view: AttendanceView;
  /** Mondays as "YYYY-MM-DD", newest first, with their labels. */
  weeks: Option[];
  selectedWeek: string;
  /** Months as "YYYY-MM", newest first, with their labels. */
  months: Option[];
  selectedMonth: string;
};

const VIEWS: { value: AttendanceView; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

const selectClass =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:opacity-60";

/**
 * Today, a week or a month of attendance. The page opens on today; Week and
 * Month look back, each with its own picker, which switches the page as soon
 * as a choice is made.
 */
export default function AttendanceFilter({
  view,
  weeks,
  selectedWeek,
  months,
  selectedMonth,
}: AttendanceFilterProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const go = (query: string) => startTransition(() => router.push(`/attendance${query}`));

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={isPending}>
      <div role="group" aria-label="Show attendance for" className="inline-flex rounded-md border border-slate-300 bg-white p-0.5">
        {VIEWS.map((option) => {
          const active = option.value === view;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              disabled={isPending}
              onClick={() => {
                if (!active) {
                  go(option.value === "today" ? "" : `?view=${option.value}`);
                }
              }}
              className={`rounded px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#770FC2]/40 disabled:opacity-60 ${
                active
                  ? "bg-[#6B1BBD] text-white shadow-sm"
                  : "text-slate-600 hover:bg-[#F3E8FF] hover:text-[#770FC2]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {view === "week" ? (
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Week</span>
          <select
            // Remounts on Back / Forward, so the box follows the week on screen.
            key={selectedWeek}
            defaultValue={selectedWeek}
            disabled={isPending}
            onChange={(event) => go(`?view=week&week=${event.target.value}`)}
            className={selectClass}
          >
            {weeks.map((week) => (
              <option key={week.value} value={week.value}>
                {week.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {view === "month" ? (
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Month</span>
          <select
            key={selectedMonth}
            defaultValue={selectedMonth}
            disabled={isPending}
            onChange={(event) => go(`?view=month&month=${event.target.value}`)}
            className={selectClass}
          >
            {months.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
