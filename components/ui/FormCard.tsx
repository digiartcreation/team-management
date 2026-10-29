import Link from "next/link";
import type { ReactNode } from "react";
import SubmitButton from "@/components/ui/SubmitButton";

/**
 * A form laid out as a card: a heading and one line about it, the fields,
 * and a footer with Cancel and the submit button, which locks and spins
 * while the save runs.
 */
export default function FormCard({
  action,
  title,
  description,
  cancelHref,
  submitLabel,
  pendingLabel = "Saving...",
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  title: string;
  description: string;
  cancelHref: string;
  submitLabel: string;
  pendingLabel?: string;
  children: ReactNode;
}) {
  return (
    <form
      action={action}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="border-b border-slate-100 px-6 py-5 sm:px-8">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <p className="mt-0.5 text-sm text-gray-500">{description}</p>
      </div>

      <div className="grid gap-6 px-6 py-6 sm:px-8">{children}</div>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-8">
        <Link
          href={cancelHref}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
        >
          Cancel
        </Link>
        <SubmitButton
          pendingLabel={pendingLabel}
          className="rounded-lg bg-[#770FC2] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6B1BBD]"
        >
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
