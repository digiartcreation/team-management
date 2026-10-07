"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type MonthFilterProps = {
  months: { value: string; label: string }[];
  selected: string;
};

/** Switches the attendance page to another month as soon as one is picked. */
export default function MonthFilter({ months, selected }: MonthFilterProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-medium text-slate-600">Month</span>
      <select
        // Remounts on Back / Forward, so the box follows the month on screen.
        key={selected}
        defaultValue={selected}
        disabled={isPending}
        onChange={(event) => {
          const month = event.target.value;
          startTransition(() => router.push(`/attendance?month=${month}`));
        }}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
      >
        {months.map((month) => (
          <option key={month.value} value={month.value}>
            {month.label}
          </option>
        ))}
      </select>
    </label>
  );
}
