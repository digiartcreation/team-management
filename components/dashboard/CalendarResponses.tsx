"use client";

import { useState, useTransition } from "react";
import { respondToCalendarEvent } from "@/app/calendar/actions";
import Avatar from "@/components/ui/Avatar";
import type { CalendarEntry } from "@/lib/calendar";
import { OFFICE_TIME_ZONE } from "@/lib/officeTime";

type Person = CalendarEntry["sharedWith"][number];

const respondedFormatter = new Intl.DateTimeFormat("en", {
  timeZone: OFFICE_TIME_ZONE,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

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

const GROUPS = [
  {
    response: "accepted",
    label: "Accepted",
    tile: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    icon: "M5 10.5l3 3 7-7",
  },
  {
    response: "declined",
    label: "Declined",
    tile: "border-red-200 bg-red-50 text-red-700",
    dot: "bg-red-500",
    icon: "M6 6l8 8M14 6l-8 8",
  },
  {
    response: "pending",
    label: "Awaiting reply",
    tile: "border-gray-200 bg-gray-50 text-gray-600",
    dot: "bg-gray-400",
    icon: "M10 6v4l2.5 2",
  },
] as const;

function groupOf(response: string) {
  return GROUPS.find((group) => group.response === response) ?? GROUPS[2];
}

function StatusIcon({ response, className = "h-3 w-3" }: { response: string; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="2.2">
      {response === "pending" ? <circle cx="10" cy="10" r="7" /> : null}
      <path d={groupOf(response).icon} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A small "✓ Accepted" style pill. */
export function StatusPill({ response }: { response: string }) {
  const group = groupOf(response);

  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${group.tile}`}>
      <StatusIcon response={response} />
      {group.label}
    </span>
  );
}

/**
 * Who an entry is shared with and how each has answered: a count of each
 * answer, then the people under each -- when they answered, and why for a
 * decline. Shown in an entry's details to its author and everyone invited.
 */
export function CalendarResponseBoard({
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
    <section className="grid gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Responses
        </h3>
        <span className="text-xs text-slate-500">
          {people.length} {people.length === 1 ? "person" : "people"} invited
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {GROUPS.map((group) => {
          const count = people.filter((person) => person.response === group.response).length;

          return (
            <div key={group.response} className={`rounded-lg border px-3 py-2 ${group.tile}`}>
              <p className="flex items-center gap-1 text-[11px] font-medium">
                <StatusIcon response={group.response} />
                {group.label}
              </p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums">{count}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3">
        {GROUPS.map((group) => {
          const members = people.filter((person) => person.response === group.response);

          if (members.length === 0) {
            return null;
          }

          return (
            <div key={group.response} className="grid gap-1.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <span aria-hidden className={`h-2 w-2 rounded-full ${group.dot}`} />
                {group.label} · {members.length}
              </p>
              <ul className="grid divide-y divide-slate-100 rounded-lg border border-slate-200">
                {members.map((person) => (
                  <li key={person.id} className="grid gap-1.5 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <Avatar name={person.name} />
                        <span className="truncate text-sm font-medium text-gray-900">
                          {person.name}
                          {person.id === viewerId ? (
                            <span className="font-normal text-gray-400"> (you)</span>
                          ) : null}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-gray-500">
                        {person.respondedAt
                          ? respondedFormatter.format(new Date(person.respondedAt))
                          : "No reply yet"}
                      </span>
                    </div>
                    {person.response === "declined" && person.reason ? (
                      <p className="ml-9 whitespace-pre-line break-words rounded-md border-l-2 border-red-300 bg-red-50/60 px-2.5 py-1.5 text-xs text-gray-700">
                        {person.reason}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * The viewer's answer to an entry shared with them: Accept, or Decline with
 * a reason, while they have not answered; then what they chose, the reason
 * for a decline, and a way to change their mind.
 */
export function CalendarRsvp({
  eventId,
  response,
  reason,
  onResponded,
}: {
  eventId: string;
  response: string;
  /** Their reason, when they have declined. */
  reason: string | null;
  /** Called once the answer is saved, to reload what shows it. */
  onResponded: () => void;
}) {
  // Shown straight away; the reload that follows confirms it.
  const [current, setCurrent] = useState(response);
  const [currentReason, setCurrentReason] = useState(reason ?? "");
  const [declining, setDeclining] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function answer(next: "accepted" | "declined", why = "") {
    setError(null);
    const previous = { response: current, reason: currentReason };
    setCurrent(next);
    setCurrentReason(next === "declined" ? why : "");
    setDeclining(false);

    startTransition(async () => {
      const result = await respondToCalendarEvent(eventId, next, why);

      if (result?.error) {
        setCurrent(previous.response);
        setCurrentReason(previous.reason);
        setError(result.error);
      } else {
        onResponded();
      }
    });
  }

  function startDecline() {
    setError(null);
    setDraft("");
    setDeclining(true);
  }

  const buttonBase =
    "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60";

  return (
    <div className="grid gap-2">
      {declining ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            answer("declined", draft);
          }}
          className="grid gap-2"
        >
          <label className="grid gap-1">
            <span className="text-xs font-medium text-gray-700">
              Why can&apos;t you attend?
            </span>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={2}
              required
              autoFocus
              placeholder="Eg: Client visit at the same time"
              className="w-full resize-y rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending || !draft.trim()}
              className={`${buttonBase} bg-red-600 text-white hover:bg-red-700`}
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => setDeclining(false)}
              className={`${buttonBase} border border-slate-300 bg-white text-gray-700 hover:bg-gray-50`}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : current === "pending" ? (
        <div className="grid gap-2">
          <p className="text-xs font-medium text-gray-700">Will you attend?</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => answer("accepted")}
              disabled={isPending}
              className={`${buttonBase} bg-emerald-600 text-white hover:bg-emerald-700`}
            >
              <StatusIcon response="accepted" />
              Accept
            </button>
            <button
              type="button"
              onClick={startDecline}
              disabled={isPending}
              className={`${buttonBase} border border-red-200 bg-white text-red-600 hover:bg-red-50`}
            >
              <StatusIcon response="declined" />
              Decline
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill response={current} />
            <span className="text-xs text-gray-500">
              {current === "accepted" ? "You're going." : "You're not going."}
            </span>
          </div>
          {current === "declined" && currentReason ? (
            <p className="whitespace-pre-line break-words rounded-md border-l-2 border-red-300 bg-red-50/60 px-2.5 py-1.5 text-xs text-gray-700">
              {currentReason}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => (current === "accepted" ? startDecline() : answer("accepted"))}
            disabled={isPending}
            className="justify-self-start text-xs font-medium text-[#770FC2] hover:underline disabled:opacity-60"
          >
            {current === "accepted" ? "Can't attend? Decline" : "Accept instead"}
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
