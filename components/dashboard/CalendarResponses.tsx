"use client";

import { useState, useTransition } from "react";
import { respondToCalendarEvent } from "@/app/calendar/actions";
import Avatar from "@/components/ui/Avatar";

type Person = { id: string; name: string; response: string };

/** "2 accepted · 1 declined · 1 awaiting reply", leaving out what is zero. */
export function responseSummary(people: Person[]) {
  const accepted = people.filter((person) => person.response === "accepted").length;
  const declined = people.filter((person) => person.response === "declined").length;
  const pending = people.length - accepted - declined;

  return [
    accepted ? `${accepted} accepted` : null,
    declined ? `${declined} declined` : null,
    pending ? `${pending} awaiting reply` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

const STATUS: Record<string, { label: string; className: string; icon: string }> = {
  accepted: {
    label: "Accepted",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    icon: "M5 10.5l3 3 7-7",
  },
  declined: {
    label: "Declined",
    className: "bg-red-50 text-red-700 ring-red-200",
    icon: "M6 6l8 8M14 6l-8 8",
  },
  pending: {
    label: "Awaiting reply",
    className: "bg-gray-100 text-gray-600 ring-gray-200",
    icon: "M10 6v4l2.5 2",
  },
};

function StatusPill({ response }: { response: string }) {
  const status = STATUS[response] ?? STATUS.pending;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${status.className}`}
    >
      <svg aria-hidden viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2">
        {response === "pending" ? <circle cx="10" cy="10" r="7" /> : null}
        <path d={status.icon} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {status.label}
    </span>
  );
}

/**
 * Everyone an entry is shared with and how each has answered, under a line
 * counting them up. Shown to its author and to everyone it is shared with.
 */
export function CalendarAttendees({
  people,
  viewerId,
}: {
  people: Person[];
  /** Marks the viewer's own row "(you)". */
  viewerId?: string;
}) {
  if (people.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-2 rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3 className="text-xs font-medium uppercase tracking-normal text-slate-500">
          Responses
        </h3>
        <p className="text-xs text-slate-500">{responseSummary(people)}</p>
      </div>
      <ul className="grid gap-1.5">
        {people.map((person) => (
          <li key={person.id} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <Avatar name={person.name} />
              <span className="truncate text-sm text-gray-800">
                {person.name}
                {person.id === viewerId ? (
                  <span className="text-gray-400"> (you)</span>
                ) : null}
              </span>
            </span>
            <StatusPill response={person.response} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The viewer's answer to an entry shared with them: Accept and Decline while
 * they have not answered, then what they chose with a way to change it.
 */
export function CalendarRsvp({
  eventId,
  response,
  onResponded,
}: {
  eventId: string;
  response: string;
  /** Called once the answer is saved, to reload what shows it. */
  onResponded: () => void;
}) {
  // Shown straight away; the reload that follows confirms it.
  const [current, setCurrent] = useState(response);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function answer(next: "accepted" | "declined") {
    setError(null);
    const previous = current;
    setCurrent(next);

    startTransition(async () => {
      const result = await respondToCalendarEvent(eventId, next);

      if (result?.error) {
        setCurrent(previous);
        setError(result.error);
      } else {
        onResponded();
      }
    });
  }

  const buttonBase =
    "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60";

  return (
    <div className="grid gap-1.5">
      {current === "pending" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-600">Will you attend?</span>
          <button
            type="button"
            onClick={() => answer("accepted")}
            disabled={isPending}
            className={`${buttonBase} bg-emerald-600 text-white hover:bg-emerald-700`}
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => answer("declined")}
            disabled={isPending}
            className={`${buttonBase} border border-red-200 bg-white text-red-600 hover:bg-red-50`}
          >
            Decline
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill response={current} />
          <span className="text-xs text-gray-500">
            {current === "accepted" ? "You're going." : "You're not going."}
          </span>
          <button
            type="button"
            onClick={() => answer(current === "accepted" ? "declined" : "accepted")}
            disabled={isPending}
            className="text-xs font-medium text-[#770FC2] hover:underline disabled:opacity-60"
          >
            {current === "accepted" ? "Decline instead" : "Accept instead"}
          </button>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
