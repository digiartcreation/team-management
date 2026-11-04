"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import SidebarNav, { type SidebarNavProps } from "@/components/layout/SidebarNav";

type MobileNavProps = SidebarNavProps & {
  /** "Employee Dashboard" and the like, under the company name. */
  title: string;
  /** Where the logo leads: the viewer's own dashboard. */
  homeHref: string;
};

function Logo() {
  return (
    <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md">
      <Image
        src="/digiart-logo.jpg"
        alt="Digiart Creation logo"
        fill
        sizes="36px"
        className="object-contain"
      />
    </span>
  );
}

/**
 * The menu below the desktop breakpoint: a bar along the top with the logo
 * and a menu button, which slides the full menu in from the left. The sidebar
 * itself only shows on wide screens.
 */
export default function MobileNav({ title, homeHref, ...navProps }: MobileNavProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const { alertCounts = {}, calendarCounts, unreadNotifications = 0 } = navProps;
  // Something waiting somewhere in the menu: a dot on the button says so.
  const hasNews =
    Object.values(alertCounts).some((count) => (count ?? 0) > 0) ||
    (calendarCounts?.today ?? 0) > 0 ||
    unreadNotifications > 0;

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }

    // The page behind stays put while the menu is open.
    document.documentElement.style.overflow = open ? "hidden" : "";

    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white/95 px-4 py-2.5 shadow-sm backdrop-blur lg:hidden">
        <Link href={homeHref} className="flex min-w-0 items-center gap-2.5">
          <Logo />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold leading-tight text-[#1F2937]">
              Digiart Creation
            </span>
            <span className="block truncate text-xs text-[#6B7280]">{title}</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#E5E7EB] text-[#1F2937] transition hover:border-[#A05DD0] hover:bg-[#F3E8FF] hover:text-[#770FC2]"
        >
          <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />
          </svg>
          {hasNews ? (
            <span aria-hidden className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#770FC2] ring-2 ring-white" />
          ) : null}
        </button>
      </header>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        aria-label="Menu"
        // A tap on the backdrop lands on the dialog itself, the panel inside
        // filling it; a tap on a link leaves for its page.
        onClick={(event) => {
          if (
            event.target === event.currentTarget ||
            (event.target as HTMLElement).closest("a")
          ) {
            setOpen(false);
          }
        }}
        className="mobile-drawer m-0 h-dvh max-h-none w-[min(20rem,86vw)] max-w-none border-0 bg-white p-0 text-left shadow-2xl backdrop:bg-slate-950/40 lg:hidden"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] px-4 py-3">
            <span className="flex min-w-0 items-center gap-2.5">
              <Logo />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[#1F2937]">
                  Digiart Creation
                </span>
                <span className="block truncate text-xs text-[#6B7280]">{title}</span>
              </span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[#6B7280] transition hover:bg-[#F3E8FF] hover:text-[#770FC2]"
            >
              <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <SidebarNav {...navProps} variant="drawer" />
          </div>
        </div>
      </dialog>
    </>
  );
}
