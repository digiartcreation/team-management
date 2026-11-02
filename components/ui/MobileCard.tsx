import type { ReactNode } from "react";

/**
 * Phone layout for the list pages: below the md breakpoint a page swaps its
 * wide table for a stack of these cards. Each is folded to its title, a line
 * under it and a status, and opens on a tap to everything the table row
 * shows, with the row's actions at the foot. Plain <details>, so they work in
 * server components without any script.
 */
export function MobileCardList({ children }: { children: ReactNode }) {
  // grid-cols-1 is minmax(0, 1fr): without it the one column grows to fit
  // the longest unbroken line -- an email, a long designation -- and every
  // card runs off the right of the screen.
  return <div className="grid grid-cols-1 gap-3 md:hidden">{children}</div>;
}

export function MobileCard({
  title,
  subtitle,
  status,
  actions,
  children,
}: {
  title: ReactNode;
  /** One line under the title while folded: who, which client, when. */
  subtitle?: ReactNode;
  /** A pill on the right of the folded card. */
  status?: ReactNode;
  /** The row's actions, along the foot of the open card. */
  actions?: ReactNode;
  /** The open card's fields, usually MobileFields. */
  children?: ReactNode;
}) {
  return (
    <details className="group min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm transition open:border-[#A05DD0]/50 open:shadow-md">
      {/* A soft brand ring for the keyboard instead of the browser's heavy
          black outline, which also showed after a tap. */}
      <summary className="flex cursor-pointer list-none items-start gap-3 rounded-lg px-4 py-3.5 outline-none focus-visible:ring-2 focus-visible:ring-[#A05DD0]/50 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block break-words text-sm font-semibold leading-snug text-slate-950">
            {title}
          </span>
          {subtitle ? (
            <span className="mt-1 block truncate text-xs text-slate-500">
              {subtitle}
            </span>
          ) : null}
        </span>
        {status ? <span className="shrink-0">{status}</span> : null}
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 7.5l5 5 5-5" />
        </svg>
      </summary>
      {children || actions ? (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3">
          {children ? <dl className="grid gap-3">{children}</dl> : null}
          {actions ? (
            <div
              className={`flex flex-wrap items-center gap-2 ${
                children ? "mt-4 border-t border-slate-100 pt-3" : ""
              }`}
            >
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}
    </details>
  );
}

/** One labelled value in an open MobileCard. */
export function MobileField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-sm text-slate-700">{children}</dd>
    </div>
  );
}
