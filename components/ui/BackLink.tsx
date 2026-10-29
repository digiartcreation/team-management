import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The "Back to ..." link at the top of a page: a left chevron that nudges
 * left on hover, in the same place and style on every page.
 */
export default function BackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex w-fit items-center gap-1.5 rounded-md py-1 pr-2 text-sm font-medium text-slate-500 transition hover:text-[#770FC2]"
    >
      <span
        aria-hidden
        className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition group-hover:-translate-x-0.5 group-hover:border-[#A05DD0] group-hover:text-[#770FC2]"
      >
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M12 15 7 10l5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {children}
    </Link>
  );
}
