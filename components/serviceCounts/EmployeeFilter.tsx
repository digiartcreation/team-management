"use client";

import { useEffect, useState } from "react";

type EmployeeOption = {
  /** The user id, or "" for everyone. */
  value: string;
  label: string;
  /** The page with this choice and the dates on screen kept. */
  href: string;
};

type EmployeeFilterProps = {
  options: EmployeeOption[];
  selected: string;
};

/**
 * Narrows the Services Count to one employee's tasks. A choice loads the page
 * at once, as a full page load like the date links and forms beside it.
 */
export default function EmployeeFilter({ options, selected }: EmployeeFilterProps) {
  const [loading, setLoading] = useState(false);

  // Back from the next page can restore this one as it was left, still
  // loading; make the box usable again.
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) setLoading(false);
    };

    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);

  return (
    <label className="flex w-full items-center gap-2 sm:w-auto">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Employee
      </span>
      <select
        // Keeps the new choice showing while its page loads.
        key={selected}
        defaultValue={selected}
        disabled={loading}
        aria-busy={loading}
        onChange={(event) => {
          const option = options.find((item) => item.value === event.target.value);

          if (option) {
            setLoading(true);
            window.location.assign(option.href);
          }
        }}
        className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none transition hover:border-[#A05DD0] focus:border-[#770FC2] focus:ring-2 focus:ring-[#770FC2]/20 disabled:cursor-wait disabled:opacity-60 sm:w-56 sm:flex-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
