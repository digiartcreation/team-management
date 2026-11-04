"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

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

type Position = {
  /** Lined up with the trigger's right edge, or its left when that has room. */
  right?: number;
  left?: number;
  top?: number;
  bottom?: number;
  /** The room on the side it opens to; a taller menu scrolls inside it. */
  maxHeight: number;
};

const ActionMenuContext = createContext<{ close: () => void } | null>(null);

/**
 * Lets an item inside the menu dismiss it once its work is done -- saving a
 * time entry, updating a status -- instead of leaving the panel sitting open
 * over the row it just changed. Returns null outside a menu, so a component
 * used in both places can call it unconditionally.
 */
export function useActionMenu() {
  return useContext(ActionMenuContext);
}

const triggerBase =
  "flex h-8 cursor-pointer items-center rounded-md border bg-white transition [&::-webkit-details-marker]:hidden";

const GAP = 8;
const EDGE = 8;

export default function ActionMenu({
  children,
  label = "Open row menu",
  trigger,
}: ActionMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);

  /*
    The menu is portalled to the body rather than positioned inside the row.
    Table rows live in a horizontally scrolling container, and an absolutely
    positioned child of that container is clipped by it: the menu was cut off
    at the table's edge with its lower half unreachable. Fixed coordinates off
    the trigger's rect put it above the page instead, clipped by nothing.
  */
  const updatePosition = useCallback(() => {
    const triggerEl = triggerRef.current;
    const menu = menuRef.current;

    if (!triggerEl || !menu) {
      return;
    }

    const rect = triggerEl.getBoundingClientRect();
    const roomBelow = window.innerHeight - rect.bottom - GAP - EDGE;
    const roomAbove = rect.top - GAP - EDGE;
    // Below when it fits, else on whichever side has more room -- on a phone
    // neither may hold it all, and it then scrolls instead of running off the
    // screen. scrollHeight, as the cap may already be holding it short.
    const below = menu.scrollHeight <= roomBelow || roomBelow >= roomAbove;
    // Hanging left from the trigger's right edge, unless that would run off
    // the left of the screen -- a trigger near the left, as on a phone card
    // -- when it hangs right from the trigger's left edge instead.
    const hangsLeft = rect.right - menu.offsetWidth >= EDGE;

    setPosition({
      ...(hangsLeft
        ? { right: Math.max(EDGE, window.innerWidth - rect.right) }
        : {
            left: Math.max(
              EDGE,
              Math.min(rect.left, window.innerWidth - menu.offsetWidth - EDGE)
            ),
          }),
      ...(below
        ? { top: rect.bottom + GAP, maxHeight: roomBelow }
        : { bottom: window.innerHeight - rect.top + GAP, maxHeight: roomAbove }),
    });
  }, []);

  // Measured before paint, so the menu never shows in the wrong place first.
  useLayoutEffect(() => {
    if (open) {
      updatePosition();
    } else {
      setPosition(null);
    }
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function close() {
      // A modal dialog raised from inside the menu sits in the browser's top
      // layer but is still a DOM child of it, so closing the menu would take
      // the dialog down with it mid-edit. Its own backdrop handles dismissal.
      if (menuRef.current?.querySelector("dialog[open]")) {
        return;
      }

      setOpen(false);
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        close();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }

    // Capture phase: the table scrolls in its own container, and a scroll there
    // does not bubble. Without this the menu would sit where the row used to be.
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  const menu = useMemo(() => ({ close: () => setOpen(false) }), []);

  const accent = open
    ? "border-[#A05DD0] bg-[#F3E8FF] text-[#770FC2]"
    : "border-[#E5E7EB] hover:border-[#A05DD0] hover:bg-[#F3E8FF] hover:text-[#770FC2]";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        // The visible word is the accessible name already; labelling over it
        // would hide what the button actually says.
        aria-label={trigger ? undefined : label}
        onClick={() => setOpen((current) => !current)}
        className={
          trigger
            ? `${triggerBase} ${accent} gap-1.5 px-3 text-sm font-medium ${open ? "" : "text-[#770FC2]"}`
            : `${triggerBase} ${accent} w-8 justify-center ${open ? "" : "text-[#6B7280]"}`
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
              className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
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
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              style={{
                position: "fixed",
                right: position?.right,
                left: position?.left,
                top: position?.top,
                bottom: position?.bottom,
                maxHeight: position?.maxHeight,
                visibility: position ? "visible" : "hidden",
              }}
              className="z-50 min-w-44 max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded-md border border-[#E5E7EB] bg-white p-1 text-left shadow-lg"
            >
              <div className="grid gap-1">
                <ActionMenuContext.Provider value={menu}>
                  {children}
                </ActionMenuContext.Provider>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
