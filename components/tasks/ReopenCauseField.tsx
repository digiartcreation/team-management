"use client";

import { useId } from "react";
import { REOPEN_CAUSES, type ReopenCause } from "@/lib/taskStatus";

type ReopenCauseFieldProps = {
  value: ReopenCause;
  onChange: (cause: ReopenCause) => void;
};

/** Because of client / Because of us, asked whenever a task is reopened. */
export default function ReopenCauseField({ value, onChange }: ReopenCauseFieldProps) {
  // Several tasks' controls can be on one page, so each group needs its own name.
  const name = useId();

  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-xs font-medium uppercase tracking-normal text-slate-500">
        Reopened
      </legend>
      <div className="grid grid-cols-2 gap-2">
        {REOPEN_CAUSES.map((cause) => (
          <label
            key={cause.value}
            className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
              value === cause.value
                ? "border-[#770FC2] bg-[#F3E8FF] font-medium text-[#770FC2]"
                : "border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={cause.value}
              checked={value === cause.value}
              onChange={() => onChange(cause.value)}
              className="accent-[#770FC2]"
            />
            {cause.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
