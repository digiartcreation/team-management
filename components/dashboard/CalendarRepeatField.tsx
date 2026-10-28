"use client";

import { useState } from "react";
import {
  CALENDAR_RECURRENCES,
  WEEKDAYS,
  describeRepeat,
  formatShortDay,
  isoWeekday,
  ordinal,
  type RepeatRule,
} from "@/lib/calendar";

type CalendarRepeatFieldProps = {
  /** "YYYY-MM-DD": the entry's date, which a repeat starts from. */
  startDate: string;
  recurrence: string;
  onRecurrenceChange: (recurrence: string) => void;
  /** How the entry repeats already, when editing one. */
  initial: Pick<RepeatRule, "repeatDays" | "repeatMonthDay" | "repeatUntil"> | null;
};

const labelClass = "text-xs font-medium uppercase tracking-normal text-slate-500";

const MONTH_DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

/**
 * How an entry repeats: not at all, weekly on the weekdays picked, or monthly
 * on the day picked, until a last date or for good. Until the weekdays or the
 * day are picked by hand they follow the start date, so moving the date moves
 * the repeat with it. Posts recurrence, repeatDays, repeatMonthDay and
 * repeatUntil, and says in words what it adds up to.
 */
export default function CalendarRepeatField({
  startDate,
  recurrence,
  onRecurrenceChange,
  initial,
}: CalendarRepeatFieldProps) {
  const [pickedDays, setPickedDays] = useState<number[] | null>(
    initial && initial.repeatDays.length > 0 ? initial.repeatDays : null
  );
  const [pickedMonthDay, setPickedMonthDay] = useState<number | null>(
    initial?.repeatMonthDay ?? null
  );
  const [endsOn, setEndsOn] = useState(Boolean(initial?.repeatUntil));
  const [until, setUntil] = useState(initial?.repeatUntil ?? "");

  const days = pickedDays ?? [isoWeekday(startDate)];
  const monthDay = pickedMonthDay ?? Number(startDate.slice(8));
  const repeatUntil = endsOn && until ? until : null;

  function toggleDay(day: number) {
    const next = days.includes(day)
      ? days.filter((value) => value !== day)
      : [...days, day].sort((a, b) => a - b);

    // At least one day has to stay picked, or it would never fall anywhere.
    if (next.length > 0) {
      setPickedDays(next);
    }
  }

  const summary =
    recurrence === "none"
      ? null
      : describeRepeat({
          seriesDate: startDate,
          recurrence,
          repeatDays: days,
          repeatMonthDay: monthDay,
          repeatUntil: null,
        });

  return (
    <fieldset className="grid gap-3 rounded-lg border border-slate-200 p-4">
      <legend className={`${labelClass} px-1`}>Repeat</legend>

      <div
        role="radiogroup"
        aria-label="How often it repeats"
        className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1"
      >
        {CALENDAR_RECURRENCES.map((option) => {
          const active = recurrence === option.value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onRecurrenceChange(option.value)}
              className={`rounded-md px-2 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-white text-[#770FC2] shadow-sm"
                  : "text-gray-600 hover:text-[#770FC2]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {recurrence === "weekly" ? (
        <div className="grid gap-2">
          <span className={labelClass}>Repeat on</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days of the week">
            {WEEKDAYS.map((weekday) => {
              const on = days.includes(weekday.value);

              return (
                <button
                  key={weekday.value}
                  type="button"
                  aria-pressed={on}
                  aria-label={weekday.long}
                  onClick={() => toggleDay(weekday.value)}
                  className={`h-9 min-w-11 rounded-full border px-2.5 text-sm font-medium transition ${
                    on
                      ? "border-[#770FC2] bg-[#770FC2] text-white"
                      : "border-gray-300 bg-white text-gray-700 hover:border-[#A05DD0]"
                  }`}
                >
                  {weekday.short}
                </button>
              );
            })}
          </div>
          <span className="text-xs text-slate-500">
            Pick one or more days. Weekdays only? Pick Mon to Fri.
          </span>
        </div>
      ) : null}

      {recurrence === "monthly" ? (
        <label className="grid gap-2">
          <span className={labelClass}>On day</span>
          <span className="flex items-center gap-2 text-sm text-gray-700">
            <select
              value={monthDay}
              onChange={(event) => setPickedMonthDay(Number(event.target.value))}
              className="w-28 rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {MONTH_DAYS.map((day) => (
                <option key={day} value={day}>
                  {ordinal(day)}
                </option>
              ))}
            </select>
            of every month
          </span>
          {monthDay > 28 ? (
            <span className="text-xs text-slate-500">
              In a month without the {ordinal(monthDay)}, it falls on the last day.
            </span>
          ) : null}
        </label>
      ) : null}

      {recurrence !== "none" ? (
        <div className="grid gap-2">
          <span className={labelClass}>Ends</span>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-800">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="repeatEnds"
                checked={!endsOn}
                onChange={() => setEndsOn(false)}
                className="accent-[#770FC2]"
              />
              Never
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="repeatEnds"
                checked={endsOn}
                onChange={() => setEndsOn(true)}
                className="accent-[#770FC2]"
              />
              On
            </label>
            <input
              type="date"
              aria-label="Last day it repeats"
              value={until}
              min={startDate}
              disabled={!endsOn}
              required={endsOn}
              onChange={(event) => setUntil(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>
      ) : null}

      {summary ? (
        <p className="flex items-start gap-2 rounded-md bg-[#F8F7FB] px-3 py-2 text-sm text-[#5B0B96]">
          <svg aria-hidden viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 10a6 6 0 0 1 10.2-4.3L16 7.5M16 3.5v4h-4M16 10a6 6 0 0 1-10.2 4.3L4 12.5M4 16.5v-4h4" />
          </svg>
          <span>
            {summary}, from {formatShortDay(startDate)}
            {repeatUntil ? ` until ${formatShortDay(repeatUntil)}` : ""}
          </span>
        </p>
      ) : null}

      <input type="hidden" name="recurrence" value={recurrence} />
      {recurrence === "weekly" ? (
        <input type="hidden" name="repeatDays" value={days.join(",")} />
      ) : null}
      {recurrence === "monthly" ? (
        <input type="hidden" name="repeatMonthDay" value={monthDay} />
      ) : null}
      {repeatUntil ? <input type="hidden" name="repeatUntil" value={repeatUntil} /> : null}
    </fieldset>
  );
}
