"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import CalendarEntryDialog from "@/components/dashboard/CalendarEntryDialog";
import { deleteCalendarEvent } from "@/app/calendar/actions";
import {
  CALENDAR_EVENT_TYPES,
  calendarEventTypeLabel,
  calendarGridDays,
  formatCalendarDay,
  formatCalendarMonth,
  formatCalendarTimes,
  shiftCalendarMonth,
  type CalendarEntry,
} from "@/lib/calendar";

type DashboardCalendarProps = {
  /** Today on the office clock, "YYYY-MM-DD". The calendar opens on its month. */
  today: string;
  /**
   * The entries on that month's grid, from loadCalendarMonth
   * (lib/calendarEvents.ts), so the calendar opens filled in. Other months are
   * fetched from /api/calendar as they are paged to.
   */
  initialEntries: CalendarEntry[];
};

/**
 * The open dialog: an entry to edit (or view, when the viewer cannot change
 * it), or a new one starting on `date`.
 */
type DialogState = { entry: CalendarEntry | null; date: string } | null;

/**
 * How each type is drawn: its dot, the tint of its chip on the grid, and the
 * coloured left edge both its chip and its card in the day list carry.
 */
const TYPE_TONE: Record<string, { dot: string; tint: string; edge: string }> = {
  meeting: {
    dot: "bg-sky-500",
    tint: "bg-sky-50 text-sky-800",
    edge: "border-l-sky-500",
  },
  client_meeting: {
    dot: "bg-[#770FC2]",
    tint: "bg-[#F3E8FF] text-[#5B0B96]",
    edge: "border-l-[#770FC2]",
  },
  training: {
    dot: "bg-amber-500",
    tint: "bg-amber-50 text-amber-800",
    edge: "border-l-amber-500",
  },
  event: {
    dot: "bg-emerald-500",
    tint: "bg-emerald-50 text-emerald-800",
    edge: "border-l-emerald-500",
  },
  other: {
    dot: "bg-gray-400",
    tint: "bg-gray-100 text-gray-700",
    edge: "border-l-gray-400",
  },
};

function toneFor(type: string) {
  return TYPE_TONE[type] ?? TYPE_TONE.other;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Entries a day cell lists before folding the rest into "+N more". */
const CELL_LIMIT = 3;

/** "14:30" -> "2:30pm", "09:00" -> "9am": short enough for a chip. */
function chipTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const clock = minutes
    ? `${hours % 12 || 12}:${String(minutes).padStart(2, "0")}`
    : `${hours % 12 || 12}`;

  return `${clock}${hours < 12 ? "am" : "pm"}`;
}

function sharingLabel(entry: CalendarEntry) {
  if (entry.visibility !== "everyone") {
    return "Only me";
  }

  return entry.isOwn ? "Shared with everyone" : `Shared by ${entry.createdByName}`;
}

/** Asks before an entry is deleted, in the top layer like the entry dialog. */
function ConfirmDeleteDialog({
  entry,
  pending,
  onCancel,
  onConfirm,
}: {
  entry: CalendarEntry;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
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
      onClose={onCancel}
      aria-labelledby="calendar-delete-heading"
      className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-lg border border-slate-200 bg-white p-6 text-left shadow-xl backdrop:bg-slate-950/40"
    >
      <h2
        id="calendar-delete-heading"
        className="text-lg font-semibold text-slate-950"
      >
        Delete entry
      </h2>
      <p className="mt-1 break-words text-sm text-slate-500">{entry.title}</p>
      <p className="mt-4 text-sm text-slate-700">
        {entry.visibility === "everyone"
          ? "It will be removed from everyone's calendar. This cannot be undone."
          : "This cannot be undone."}
      </p>

      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
        >
          {pending ? "Deleting..." : "Delete"}
        </button>
      </div>
    </dialog>
  );
}

/**
 * A month calendar on every dashboard for meetings, client meetings, training
 * sessions and anything else worth noting against a day. Each person sees
 * their own entries and those shared with everyone.
 */
export default function DashboardCalendar({
  today,
  initialEntries,
}: DashboardCalendarProps) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDay, setSelectedDay] = useState(today);
  const [entries, setEntries] = useState(initialEntries);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleting, setDeleting] = useState<CalendarEntry | null>(null);
  const [isDeleting, startDelete] = useTransition();
  // Bumped by every load, and only the latest may write: paging quickly
  // through months must not let an older response land last.
  const requestRef = useRef(0);

  const loadMonth = useCallback(async (target: string) => {
    const request = ++requestRef.current;
    setLoading(true);

    try {
      const response = await fetch(`/api/calendar?month=${target}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Calendar request failed with ${response.status}`);
      }

      const body = (await response.json()) as { entries: CalendarEntry[] };

      if (request === requestRef.current) {
        setEntries(body.entries);
        setError(null);
      }
    } catch {
      if (request === requestRef.current) {
        setError("Could not load the calendar. Please try again.");
      }
    } finally {
      if (request === requestRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const days = useMemo(() => calendarGridDays(month), [month]);

  const entriesByDay = useMemo(() => {
    const byDay = new Map<string, CalendarEntry[]>();

    for (const entry of entries) {
      const list = byDay.get(entry.date);

      if (list) {
        list.push(entry);
      } else {
        byDay.set(entry.date, [entry]);
      }
    }

    return byDay;
  }, [entries]);

  const selectedEntries = entriesByDay.get(selectedDay) ?? [];

  function showMonth(target: string, day?: string) {
    setMonth(target);
    setSelectedDay(day ?? (today.startsWith(target) ? today : `${target}-01`));
    void loadMonth(target);
  }

  function openEntry(entry: CalendarEntry) {
    setDialog({ entry, date: entry.date });
  }

  function openNew() {
    setDialog({ entry: null, date: selectedDay });
  }

  // Stable for the dialog's effect, which calls it once the save lands.
  const handleSaved = useCallback(
    (date: string) => {
      setDialog(null);
      setSelectedDay(date);
      // Stay on this month if the day is on its grid; otherwise go to it.
      const target = days.includes(date) ? month : date.slice(0, 7);
      setMonth(target);
      void loadMonth(target);
    },
    [days, month, loadMonth]
  );

  function requestDelete(entry: CalendarEntry) {
    setDialog(null);
    setDeleting(entry);
  }

  function confirmDelete() {
    const entry = deleting;

    if (!entry) {
      return;
    }

    startDelete(async () => {
      const result = await deleteCalendarEvent(entry.id);

      if (result?.error) {
        setError(result.error);
      } else {
        setEntries((current) => current.filter((item) => item.id !== entry.id));
      }

      setDeleting(null);
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Calendar</h2>
          <p className="mt-1 text-sm text-slate-500">
            Meetings, client meetings, training sessions and anything else
            worth noting. Entries set to Only me are seen by you alone.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex shrink-0 items-center justify-center rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Add Entry
        </button>
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

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3
              aria-live="polite"
              className="text-base font-semibold text-slate-950"
            >
              {formatCalendarMonth(month)}
            </h3>
            <div className="flex items-center gap-3">
              {loading ? (
                <span className="text-xs text-slate-400">Loading...</span>
              ) : null}
              <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => showMonth(shiftCalendarMonth(month, -1))}
                  className="px-3 py-1.5 text-sm text-gray-700 transition hover:bg-slate-50"
                >
                  &#8249;
                </button>
                <button
                  type="button"
                  onClick={() => showMonth(today.slice(0, 7), today)}
                  className="border-x border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-slate-50"
                >
                  Today
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => showMonth(shiftCalendarMonth(month, 1))}
                  className="px-3 py-1.5 text-sm text-gray-700 transition hover:bg-slate-50"
                >
                  &#8250;
                </button>
              </div>
            </div>
          </div>

          <div
            className={`overflow-hidden rounded-md border border-slate-200 transition-opacity ${
              loading ? "opacity-60" : ""
            }`}
          >
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
              {WEEKDAYS.map((weekday) => (
                <div
                  key={weekday}
                  className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                >
                  <span className="sm:hidden">{weekday[0]}</span>
                  <span className="hidden sm:inline">{weekday}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {days.map((day, index) => {
                const dayEntries = entriesByDay.get(day) ?? [];
                const inMonth = day.startsWith(month);
                const isSelected = day === selectedDay;

                return (
                  // Clicking anywhere in the cell picks the day; the number is
                  // the button that does it from the keyboard.
                  <div
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`flex min-h-14 cursor-pointer flex-col gap-1 border-gray-200 p-1 transition sm:min-h-24 sm:p-1.5 ${
                      index % 7 === 6 ? "" : "border-r"
                    } ${index < days.length - 7 ? "border-b" : ""} ${
                      isSelected
                        ? "bg-[#F8F7FB] ring-2 ring-inset ring-[#A05DD0]"
                        : inMonth
                          ? "bg-white hover:bg-[#FBF7FF]"
                          : "bg-gray-50 hover:bg-[#FBF7FF]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      aria-pressed={isSelected}
                      aria-label={`${formatCalendarDay(day)}, ${dayEntries.length} ${
                        dayEntries.length === 1 ? "entry" : "entries"
                      }`}
                      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center self-center rounded-full text-xs font-medium sm:self-start ${
                        day === today
                          ? "bg-[#770FC2] text-white"
                          : inMonth
                            ? "text-gray-800"
                            : "text-gray-400"
                      }`}
                    >
                      {Number(day.slice(8))}
                    </button>

                    {/* Phones get a dot per entry; the day list spells them out. */}
                    {dayEntries.length > 0 ? (
                      <span
                        aria-hidden
                        className="flex justify-center gap-0.5 sm:hidden"
                      >
                        {dayEntries.slice(0, CELL_LIMIT).map((entry) => (
                          <span
                            key={entry.id}
                            className={`h-1.5 w-1.5 rounded-full ${toneFor(entry.type).dot}`}
                          />
                        ))}
                      </span>
                    ) : null}

                    <div className="hidden flex-col gap-1 sm:flex">
                      {dayEntries.slice(0, CELL_LIMIT).map((entry) => {
                        const tone = toneFor(entry.type);

                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => openEntry(entry)}
                            title={`${formatCalendarTimes(entry)} · ${entry.title}`}
                            className={`truncate rounded-sm border-l-2 px-1 py-0.5 text-left text-[11px] leading-tight transition hover:brightness-95 ${tone.edge} ${tone.tint}`}
                          >
                            {entry.startTime ? (
                              <span className="font-semibold">
                                {chipTime(entry.startTime)}{" "}
                              </span>
                            ) : null}
                            {entry.title}
                          </button>
                        );
                      })}
                      {dayEntries.length > CELL_LIMIT ? (
                        <span className="px-1 text-[11px] font-medium text-slate-500">
                          +{dayEntries.length - CELL_LIMIT} more
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {CALENDAR_EVENT_TYPES.map((type) => (
              <li
                key={type.value}
                className="flex items-center gap-1.5 text-xs text-slate-500"
              >
                <span
                  aria-hidden
                  className={`h-2 w-2 rounded-full ${toneFor(type.value).dot}`}
                />
                {type.label}
              </li>
            ))}
          </ul>
        </div>

        <aside className="flex flex-col rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-normal text-slate-500">
                {selectedDay === today ? "Today" : "Selected day"}
              </p>
              <h3 className="mt-1 text-base font-semibold text-slate-950">
                {formatCalendarDay(selectedDay)}
              </h3>
            </div>
            <button
              type="button"
              onClick={openNew}
              className="shrink-0 rounded-md border border-[#A05DD0]/45 bg-white px-3 py-1.5 text-xs font-medium text-[#770FC2] transition hover:border-[#A05DD0] hover:bg-[#F3E8FF]"
            >
              + Add
            </button>
          </div>

          {selectedEntries.length === 0 ? (
            <p className="mt-4 rounded-md border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">
              Nothing noted for this day.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {selectedEntries.map((entry) => {
                const tone = toneFor(entry.type);

                return (
                  <li
                    key={entry.id}
                    className={`rounded-md border border-l-4 border-gray-200 bg-white p-3 shadow-sm ${tone.edge}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-slate-500">
                        {formatCalendarTimes(entry)}
                      </p>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${tone.tint}`}
                      >
                        {calendarEventTypeLabel(entry.type)}
                      </span>
                    </div>
                    <p className="mt-1 break-words text-sm font-medium text-slate-950">
                      {entry.title}
                    </p>
                    {entry.notes ? (
                      <p className="mt-1 whitespace-pre-line break-words text-xs text-slate-600">
                        {entry.notes}
                      </p>
                    ) : null}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-[11px] text-slate-400">
                        {sharingLabel(entry)}
                      </span>
                      {entry.canManage ? (
                        <span className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => openEntry(entry)}
                            className="rounded px-2 py-1 text-xs font-medium text-[#770FC2] transition hover:bg-[#F3E8FF]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDelete(entry)}
                            className="rounded px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>

      {dialog ? (
        <CalendarEntryDialog
          key={dialog.entry?.id ?? `new-${dialog.date}`}
          entry={dialog.entry}
          date={dialog.date}
          onClose={() => setDialog(null)}
          onSaved={handleSaved}
          onDelete={requestDelete}
        />
      ) : null}

      {deleting ? (
        <ConfirmDeleteDialog
          entry={deleting}
          pending={isDeleting}
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </section>
  );
}
