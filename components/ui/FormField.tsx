import type { ReactNode } from "react";

/** The look of a text input, select or date field inside a FormField. */
export const fieldInputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400";

/**
 * One labelled field: the label, marked required (*) or optional, the control,
 * and a hint under it. The label points at the control by `htmlFor`, so a
 * control with buttons beside it still gets the click.
 */
export default function FormField({
  label,
  htmlFor,
  required = false,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-gray-800">
        {label}
        {required ? (
          <span aria-hidden className="ml-0.5 text-red-500">
            *
          </span>
        ) : (
          <span className="ml-1.5 text-xs font-normal text-gray-400">Optional</span>
        )}
      </label>
      {children}
      {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}
