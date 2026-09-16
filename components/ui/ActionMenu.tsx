"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

type ActionMenuProps = {
  children: ReactNode;
  label?: string;
  /**
   * Visible text for the trigger, e.g. "Update". Without it the trigger is the
   * three-dot icon, which suits rows whose menu is just Edit and Delete. Give
   * it a word where the menu carries a real action people go looking for.
   */
  trigger?: string;
};

const triggerBase =
  "flex h-8 cursor-pointer list-none items-center rounded-md border border-[#E5E7EB] bg-white transition hover:border-[#A05DD0] hover:bg-[#F3E8FF] hover:text-[#770FC2] group-open:border-[#A05DD0] group-open:bg-[#F3E8FF] group-open:text-[#770FC2] [&::-webkit-details-marker]:hidden";

export default function ActionMenu({
  children,
  label = "Open row menu",
  trigger,
}: ActionMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  // A details element only closes when its own summary is clicked again, which
  // leaves menus hanging open behind whatever you do next. Listeners are bound
  // only while this menu is open, so the closed rows cost nothing.
  useEffect(() => {
    if (!open) {
      return;
    }

    function close() {
      const details = detailsRef.current;

      if (!details) {
        return;
      }

      // A modal dialog raised from inside the menu sits in the browser's top
      // layer but is still a DOM child of it, so collapsing the menu would take
      // the dialog down with it mid-edit. Its own backdrop handles dismissal.
      if (details.querySelector("dialog[open]")) {
        return;
      }

      details.open = false;
      setOpen(false);
    }

    function handlePointerDown(event: PointerEvent) {
      const details = detailsRef.current;

      if (details && !details.contains(event.target as Node)) {
        close();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <details
      ref={detailsRef}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group relative inline-block text-left"
    >
      <summary
        // The visible word is the accessible name already; labelling over it
        // would hide what the button actually says.
        aria-label={trigger ? undefined : label}
        className={
          trigger
            ? `${triggerBase} gap-1.5 px-3 text-sm font-medium text-[#770FC2]`
            : `${triggerBase} w-8 justify-center text-[#6B7280]`
        }
      >
        {trigger ? (
          <>
            {trigger}
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              focusable="false"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180"
            >
              <path d="M4 6.5 8 10.5l4-4" />
            </svg>
          </>
        ) : (
          /*
            Drawn rather than typed: three full stops sit on the text baseline,
            at whatever size the font gives them, so the trigger read as
            bottom-heavy and uneven. Circles centre in the box at a fixed size.
          */
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            focusable="false"
            fill="currentColor"
            className="h-4 w-4"
          >
            <circle cx="3" cy="8" r="1.4" />
            <circle cx="8" cy="8" r="1.4" />
            <circle cx="13" cy="8" r="1.4" />
          </svg>
        )}
      </summary>
      <div className="absolute right-0 z-20 mt-2 min-w-36 max-w-[calc(100vw-2rem)] rounded-md border border-[#E5E7EB] bg-white p-1 shadow-lg">
        <div className="grid gap-1">{children}</div>
      </div>
    </details>
  );
}
