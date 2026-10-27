"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { saveCalendarEvent, type CalendarFormState } from "@/app/calendar/actions";
import PeoplePicker from "@/components/ui/PeoplePicker";
import {
  CALENDAR_EVENT_TYPES,
  CALENDAR_VISIBILITIES,
  DEFAULT_CALENDAR_EVENT_TYPE,
  DEFAULT_CALENDAR_VISIBILITY,
  calendarEventTypeLabel,
  describeSharing,
  formatCalendarDay,
  formatCalendarTimes,
  listNames,
  type CalendarEntry,
} from "@/lib/calendar";

type CalendarEntryDialogProps = {
  /**
   * The entry to edit, or to show read-only when the viewer cannot change it.
   * Null to add a new one.
   */
  entry: CalendarEntry | null;
  /** "YYYY-MM-DD": the day a new entry starts on. */
  date: string;
  /** Who an entry can be shared with: everyone but the viewer. */
  people: { id: string; name: string }[];
  onClose: () => void;
  /** Called with the day the entry was saved on. */
  onSaved: (date: string) => void;
  onDelete: (entry: CalendarEntry) => void;
};

const fieldClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#770FC2] focus:ring-2 focus:ring-[#770FC2]/20 disabled:cursor-not-allowed disabled:opacity-50";

const labelClass = "text-xs font-medium uppercase tracking-normal text-slate-500";

const secondaryButtonClass =
  "rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50";

/**
 * Adds, edits or shows one calendar entry, in the browser's top layer like the
 * task board's dialogs: the page's cards lift on hover with a transform,
 * which would trap a fixed overlay inside the card.
 */
export default function CalendarEntryDialog({
  entry,
  date,
  people,
  onClose,
  onSaved,
  onDelete,
}: CalendarEntryDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, isPending] = useActionState<
    CalendarFormState,
    FormData
  >(saveCalendarEvent, null);
  const [, startSubmit] = useTransition();
  // Kept in state so the end time can follow it: no end without a start, and
  // never before it.
  const [startTime, setStartTime] = useState(entry?.startTime ?? "");
  // Kept in state so picking Selected people can open the list to pick from.
  const [visibility, setVisibility] = useState<string>(
    entry?.visibility ?? DEFAULT_CALENDAR_VISIBILITY
  );
  const readOnly = Boolean(entry && !entry.canManage);
  // The others a "selected" entry went to. `people` leaves the viewer out, so
  // checking against it drops them from the list.
  const alsoSharedWith =
    entry?.visibility === "selected" && !entry.isOwn
      ? entry.sharedWith
          .filter((person) => people.some((other) => other.id === person.id))
          .map((person) => person.name)
      : [];
  const headingId = `calendar-entry-heading-${entry?.id ?? "new"}`;

  useEffect(() => {
    const dialog = dialogRef.current;

    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  useEffect(() => {
    if (state && "ok" in state) {
      onSaved(state.date);
    }
  }, [state, onSaved]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby={headingId}
      className="m-auto w-[calc(100vw-2rem)] max-w-lg rounded-lg border border-slate-200 bg-white p-0 text-left shadow-xl backdrop:bg-slate-950/40"
    >
      {entry && readOnly ? (
        <div className="grid gap-4 p-6">
          <div>
            <p className={labelClass}>{calendarEventTypeLabel(entry.type)}</p>
            <h2
              id={headingId}
              className="mt-1 break-words text-lg font-semibold text-slate-950"
            >
              {entry.title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {formatCalendarDay(entry.date)} · {formatCalendarTimes(entry)}
            </p>
          </div>

          {entry.notes ? (
            <p className="whitespace-pre-line break-words rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {entry.notes}
            </p>
          ) : null}

          <p className="text-xs text-slate-500">
            {describeSharing(entry)}
            {alsoSharedWith.length > 0
              ? ` Also shared with ${listNames(alsoSharedWith)}.`
              : ""}{" "}
            Only {entry.createdByName}
            {entry.visibility === "everyone" ? " or an admin" : ""} can change
            it.
          </p>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className={secondaryButtonClass}
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            // Sent by hand rather than through `action`, after which React
            // clears the form's fields: a rejected save would wipe out
            // everything typed along with it.
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startSubmit(() => formAction(formData));
          }}
          className="grid gap-4 p-6"
        >
          {entry ? <input type="hidden" name="id" value={entry.id} /> : null}

          <h2 id={headingId} className="text-lg font-semibold text-slate-950">
            {entry ? "Edit entry" : "Add to calendar"}
          </h2>

          <label className="grid gap-2">
            <span className={labelClass}>Title</span>
            <input
              name="title"
              type="text"
              required
              maxLength={191}
              defaultValue={entry?.title ?? ""}
              placeholder="Eg: Monthly review with the client"
              className={fieldClass}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className={labelClass}>Type</span>
              <select
                name="type"
                required
                defaultValue={entry?.type ?? DEFAULT_CALENDAR_EVENT_TYPE}
                className={fieldClass}
              >
                {CALENDAR_EVENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className={labelClass}>Date</span>
              <input
                name="date"
                type="date"
                required
                defaultValue={entry?.date ?? date}
                className={fieldClass}
              />
            </label>
          </div>

          <div className="grid gap-2">
            <div className="grid grid-cols-2 gap-4">
              <label className="grid gap-2">
                <span className={labelClass}>Start time</span>
                <input
                  name="startTime"
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className={fieldClass}
                />
              </label>

              <label className="grid gap-2">
                <span className={labelClass}>End time</span>
                {/* Disabled, and so left out of the form, until there is a start. */}
                <input
                  name="endTime"
                  type="time"
                  defaultValue={entry?.endTime ?? ""}
                  min={startTime || undefined}
                  disabled={!startTime}
                  className={fieldClass}
                />
              </label>
            </div>
            <p className="text-xs text-slate-500">
              Leave the start time empty for an all-day entry.
            </p>
          </div>

          <label className="grid gap-2">
            <span className={labelClass}>Notes (optional)</span>
            <textarea
              name="notes"
              rows={3}
              maxLength={5000}
              defaultValue={entry?.notes ?? ""}
              placeholder="Agenda, meeting link, who is joining..."
              className={`${fieldClass} resize-y`}
            />
          </label>

          {!entry || entry.isOwn ? (
            <>
              <fieldset className="grid gap-2">
                <legend className={`${labelClass} mb-2`}>Who can see it</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {CALENDAR_VISIBILITIES.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-gray-800 has-checked:border-[#A05DD0] has-checked:bg-[#F8F7FB]"
                    >
                      <input
                        type="radio"
                        name="visibility"
                        value={option.value}
                        checked={visibility === option.value}
                        onChange={() => setVisibility(option.value)}
                        className="accent-[#770FC2]"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              {visibility === "selected" ? (
                <PeoplePicker
                  people={people}
                  selectedIds={entry?.sharedWith.map((person) => person.id) ?? []}
                  name="sharedWith"
                  legend="Share with"
                  legendClassName={`${labelClass} mb-2`}
                  hint="They see this entry on their calendar and get a notification. Only you can change it."
                  groupLabel="the people it is shared with"
                />
              ) : null}
            </>
          ) : (
            <>
              <input type="hidden" name="visibility" value={entry.visibility} />
              <p className="text-xs text-slate-500">
                {describeSharing(entry)} Your changes show for everyone.
              </p>
            </>
          )}

          {state && "error" in state ? (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {state.error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-3">
            {entry ? (
              <button
                type="button"
                onClick={() => onDelete(entry)}
                disabled={isPending}
                className="mr-auto rounded-md px-2 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
              >
                Delete
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-[#770FC2] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#6B1BBD] disabled:opacity-60"
            >
              {isPending ? "Saving..." : entry ? "Save changes" : "Add entry"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
