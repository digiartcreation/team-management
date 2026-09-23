"use client";

import { useMemo, useState } from "react";
import { formatDuration } from "@/lib/duration";
import type { ReportGroup } from "@/lib/reports";

type BreakdownTableProps = {
  groupHeading: string;
  detailHeadings: string[];
  showPeople: boolean;
  groups: ReportGroup[];
  total: number;
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="m8 5 5 5-5 5" />
    </svg>
  );
}

export default function BreakdownTable({
  groupHeading,
  detailHeadings,
  showPeople,
  groups,
  total,
}: BreakdownTableProps) {
  const [query, setQuery] = useState("");
  // The biggest groups open by default; the long tail stays folded.
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(groups.slice(0, 3).map((group) => group.key))
  );

  const needle = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!needle) {
      return groups;
    }

    return groups
      .map((group) => {
        if (group.label.toLowerCase().includes(needle)) {
          return group;
        }

        const tasks = group.tasks.filter(
          (task) =>
            task.title.toLowerCase().includes(needle) ||
            task.details.some((detail) => detail?.toLowerCase().includes(needle)) ||
            task.people.some((person) => person.name.toLowerCase().includes(needle))
        );

        return tasks.length > 0 ? { ...group, tasks } : null;
      })
      .filter((group): group is ReportGroup => group !== null);
  }, [groups, needle]);

  const allOpen = visible.length > 0 && visible.every((group) => open.has(group.key));

  function toggle(key: string) {
    setOpen((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }

  const columnCount = 3 + detailHeadings.length + (showPeople ? 1 : 0);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Detailed breakdown</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {groups.length} {groups.length === 1 ? "group" : "groups"} · click a row to show its tasks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search task, client, person..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-64"
          />
          <button
            type="button"
            onClick={() =>
              setOpen(allOpen ? new Set() : new Set(visible.map((group) => group.key)))
            }
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm font-medium text-slate-700">No time logged.</p>
          <p className="mt-1 text-sm text-slate-500">
            Log time from the Tasks page or the dashboard board and it will appear here.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className="p-10 text-center text-sm text-slate-500">
          Nothing matches &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">{groupHeading}</th>
                {detailHeadings.map((heading) => (
                  <th key={heading} className="px-4 py-3 font-semibold">
                    {heading}
                  </th>
                ))}
                {showPeople ? <th className="px-4 py-3 font-semibold">People</th> : null}
                <th className="px-4 py-3 text-right font-semibold">Time</th>
                <th className="w-40 px-5 py-3 font-semibold">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((group) => {
                const isOpen = open.has(group.key) || Boolean(needle);
                const share = total > 0 ? (group.minutes / total) * 100 : 0;

                return (
                  <GroupRows
                    key={group.key}
                    group={group}
                    isOpen={isOpen}
                    onToggle={() => toggle(group.key)}
                    share={share}
                    columnCount={columnCount}
                    detailHeadings={detailHeadings}
                    showPeople={showPeople}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function GroupRows({
  group,
  isOpen,
  onToggle,
  share,
  columnCount,
  detailHeadings,
  showPeople,
}: {
  group: ReportGroup;
  isOpen: boolean;
  onToggle: () => void;
  share: number;
  columnCount: number;
  detailHeadings: string[];
  showPeople: boolean;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer bg-[#FAF7FD] transition hover:bg-[#F3E8FF]"
        aria-expanded={isOpen}
      >
        <td className="px-5 py-3" colSpan={columnCount - 2}>
          <span className="flex items-center gap-2">
            <Chevron open={isOpen} />
            <span className="font-semibold text-slate-950">{group.label}</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
              {group.tasks.length} {group.tasks.length === 1 ? "task" : "tasks"}
            </span>
            {group.reopenMinutes > 0 ? (
              <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700 ring-1 ring-orange-200">
                {formatDuration(group.reopenMinutes)} rework
              </span>
            ) : null}
          </span>
        </td>
        <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-950">
          {formatDuration(group.minutes)}
        </td>
        <td className="px-5 py-3">
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EDE3F7]">
              <div className="h-full rounded-full bg-[#770FC2]" style={{ width: `${share}%` }} />
            </div>
            <span className="w-9 text-right text-xs tabular-nums text-slate-500">
              {Math.round(share)}%
            </span>
          </div>
        </td>
      </tr>

      {isOpen
        ? group.tasks.map((task) => (
            <tr key={task.taskId} className="align-top hover:bg-slate-50">
              <td className="py-3 pl-12 pr-4">
                <p className="font-medium text-slate-800">{task.title}</p>
                {task.reopenCount > 0 ? (
                  <p className="mt-1 text-xs font-medium text-[#770FC2]">
                    Reopened {task.reopenCount} {task.reopenCount === 1 ? "time" : "times"}
                  </p>
                ) : null}
              </td>
              {task.details.map((detail, index) => (
                <td key={detailHeadings[index]} className="px-4 py-3 text-slate-600">
                  {detail ?? <span className="text-xs text-slate-400">Not mapped</span>}
                </td>
              ))}
              {showPeople ? (
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {task.people.map((person) => (
                      <span
                        key={person.userId}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                      >
                        {person.name}
                        {task.people.length > 1 ? (
                          <span className="ml-1 text-slate-400">{formatDuration(person.minutes)}</span>
                        ) : null}
                      </span>
                    ))}
                  </div>
                </td>
              ) : null}
              <td className="px-4 py-3 text-right tabular-nums">
                <p className="font-medium text-slate-800">{formatDuration(task.minutes)}</p>
                {task.reopenMinutes > 0 ? (
                  <p className="text-xs text-orange-700">
                    {formatDuration(task.reopenMinutes)} rework
                  </p>
                ) : null}
              </td>
              <td className="px-5 py-3" />
            </tr>
          ))
        : null}
    </>
  );
}
