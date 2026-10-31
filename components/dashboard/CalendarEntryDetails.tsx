"use client";

import type { ReactNode } from "react";
import {
  CalendarResponseBoard,
  CalendarRsvp,
} from "@/components/dashboard/CalendarResponses";
import {
  calendarEventTypeLabel,
  describeRepeat,
  describeSharing,
  formatCalendarDay,
  formatCalendarTimes,
  formatShortDay,
  type CalendarEntry,
} from "@/lib/calendar";

type CalendarEntryDetailsProps = {
  entry: CalendarEntry;
  headingId: string;
  /** The viewer's own place among the people it is shared with, if any. */
  viewerShareId?: string;
  onResponded: () => void;
  onClose: () => void;
  /** Offered when the viewer may change the entry. */
  onEdit?: () => void;
  onDelete?: () => void;
};

const VISIBILITY_LABEL: Record<string, string> = {
  private: "Only you",
  selected: "Selected people",
  everyone: "Everyone",
};

function Detail({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-sm text-gray-700">
      <span aria-hidden className="mt-0.5 text-gray-400">
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/**
 * Everything about one entry, read-only: when, how it repeats, who organised
 * it and who sees it, its notes, the viewer's own answer when it is shared
 * with them, and how everyone invited has answered.
 */
export default function CalendarEntryDetails({
  entry,
  headingId,
  viewerShareId,
  onResponded,
  onClose,
  onEdit,
  onDelete,
}: CalendarEntryDetailsProps) {
  const repeat = describeRepeat(entry);

  return (
    <div className="grid gap-5 p-6">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#F3E8FF] px-2.5 py-0.5 text-xs font-semibold text-[#770FC2]">
            {calendarEventTypeLabel(entry.type)}
          </span>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            {VISIBILITY_LABEL[entry.visibility] ?? "Only you"}
          </span>
        </div>
        <h2 id={headingId} className="break-words text-xl font-semibold text-slate-950">
          {entry.title}
        </h2>
      </div>

      <div className="grid gap-2">
        <Detail icon={<><rect x="3" y="4" width="14" height="13" rx="2" /><path d="M3 8h14M7 2.5v3M13 2.5v3" /></>}>
          {formatCalendarDay(entry.date)}
        </Detail>
        <Detail icon={<><circle cx="10" cy="10" r="7" /><path d="M10 6v4l2.5 2" /></>}>
          {formatCalendarTimes(entry)}
        </Detail>
        {repeat ? (
          <Detail icon={<path d="M4 10a6 6 0 0 1 10.2-4.3L16 7.5M16 3.5v4h-4M16 10a6 6 0 0 1-10.2 4.3L4 12.5M4 16.5v-4h4" />}>
            {repeat}, from {formatShortDay(entry.seriesDate)}
          </Detail>
        ) : null}
        <Detail icon={<><circle cx="10" cy="7" r="3" /><path d="M4 17a6 6 0 0 1 12 0" /></>}>
          Organised by{" "}
          <span className="font-medium text-gray-900">
            {entry.isOwn ? "you" : entry.createdByName}
          </span>
        </Detail>
      </div>

      {entry.notes ? (
        <div className="grid gap-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</h3>
          <p className="whitespace-pre-line break-words rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-gray-700">
            {entry.notes}
          </p>
        </div>
      ) : null}

      {entry.myResponse !== null ? (
        <div className="grid gap-2 rounded-lg border border-[#A05DD0]/40 bg-[#F8F7FB] p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Your response
          </h3>
          <CalendarRsvp
            // Remounted when the reload brings a new answer.
            key={`${entry.myResponse}-${entry.sharedWith.find((person) => person.id === viewerShareId)?.reason ?? ""}`}
            eventId={entry.id}
            response={entry.myResponse}
            reason={entry.sharedWith.find((person) => person.id === viewerShareId)?.reason ?? null}
            onResponded={onResponded}
          />
        </div>
      ) : null}

      {entry.visibility === "selected" ? (
        <CalendarResponseBoard people={entry.sharedWith} viewerId={viewerShareId} />
      ) : null}

      {onEdit ? null : (
        <p className="text-xs text-slate-500">
          {describeSharing(entry)} Only {entry.createdByName}
          {entry.visibility === "everyone" ? " or an admin" : ""} can change it.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="mr-auto rounded-md px-2 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 hover:text-red-700"
          >
            Delete
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Close
        </button>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md bg-[#770FC2] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#6B1BBD]"
          >
            Edit entry
          </button>
        ) : null}
      </div>
    </div>
  );
}
