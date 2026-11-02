"use client";

import { useState, type ReactNode } from "react";

/**
 * Folds a filter form's fields away on a phone, where a long form would fill
 * the first screen before any result: a Filters button saying how many are
 * set opens them. Wider screens always show the fields. The wrapper is
 * display: contents, so the fields still sit in the form's own grid.
 */
export default function MobileFilters({
  active,
  children,
}: {
  /** How many filters are set, shown on the button. */
  active: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex items-center justify-between gap-3 text-left md:hidden"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-950">
          <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 text-[#770FC2]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 5h14M6 10h8M8.5 15h3" />
          </svg>
          Filters
          {active > 0 ? (
            <span className="rounded-full bg-[#770FC2] px-2 py-0.5 text-xs font-medium text-white">
              {active} active
            </span>
          ) : null}
        </span>
        <svg aria-hidden viewBox="0 0 20 20" className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 7.5l5 5 5-5" />
        </svg>
      </button>
      <div className={open ? "contents" : "hidden md:contents"}>{children}</div>
    </>
  );
}
