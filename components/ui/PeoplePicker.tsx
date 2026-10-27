"use client";

import { useState } from "react";

type PeoplePickerProps = {
  people: { id: string; name: string }[];
  /** Who is picked to start with; empty for a new record. */
  selectedIds: string[];
  /** The form field each picked id is posted as, once per person. */
  name: string;
  legend: string;
  legendClassName?: string;
  hint?: string;
  /** What the picked people are, for screen readers: "watchers". */
  groupLabel: string;
};

/**
 * Picks any number of people from a searchable list, showing the ones picked
 * as removable chips above it. Used for a task's watchers and for who a
 * calendar entry is shared with.
 */
export default function PeoplePicker({
  people,
  selectedIds,
  name,
  legend,
  legendClassName = "text-sm font-medium text-slate-700",
  hint,
  groupLabel,
}: PeoplePickerProps) {
  const [selected, setSelected] = useState(() => new Set(selectedIds));
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? people.filter((person) => person.name.toLowerCase().includes(needle))
    : people;
  const chosen = people.filter((person) => selected.has(person.id));

  function toggle(id: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);

      if (on) {
        next.add(id);
      } else {
        next.delete(id);
      }

      return next;
    });
  }

  return (
    <fieldset className="grid gap-2">
      <legend className={legendClassName}>{legend}</legend>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}

      {chosen.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {chosen.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => toggle(person.id, false)}
              className="inline-flex items-center gap-1 rounded-full bg-[#F3E8FF] px-2.5 py-1 text-xs font-medium text-[#770FC2] transition hover:bg-[#E9D5FF]"
              aria-label={`Remove ${person.name} from ${groupLabel}`}
            >
              {person.name}
              <span aria-hidden>&times;</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="rounded-md border border-slate-300">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search employees"
          aria-label={`Search employees to add as ${groupLabel}`}
          className="w-full rounded-t-md border-0 border-b border-slate-200 px-3 py-2 text-sm outline-none"
        />
        <div className="grid max-h-48 gap-0.5 overflow-y-auto p-1 sm:grid-cols-2">
          {visible.length === 0 ? (
            <p className="px-2 py-3 text-xs text-slate-400 sm:col-span-2">
              No one matches.
            </p>
          ) : (
            visible.map((person) => (
              <label
                key={person.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(person.id)}
                  onChange={(event) => toggle(person.id, event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="truncate">{person.name}</span>
              </label>
            ))
          )}
        </div>
      </div>

      {/* Submitted from here rather than by the checkboxes, so someone hidden
          by the search still goes with the form. */}
      {[...selected].map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
    </fieldset>
  );
}
