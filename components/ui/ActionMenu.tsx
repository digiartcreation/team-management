import { ReactNode } from "react";

type ActionMenuProps = {
  children: ReactNode;
  label?: string;
};

export default function ActionMenu({
  children,
  label = "Open row menu",
}: ActionMenuProps) {
  return (
    <details className="group relative inline-block text-left">
      <summary
        aria-label={label}
        className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#6B7280] transition hover:border-[#A05DD0] hover:bg-[#F3E8FF] hover:text-[#770FC2] group-open:border-[#A05DD0] group-open:bg-[#F3E8FF] group-open:text-[#770FC2] [&::-webkit-details-marker]:hidden"
      >
        {/*
          Drawn rather than typed: three full stops sit on the text baseline, at
          whatever size the font gives them, so the trigger read as bottom-heavy
          and uneven. Circles centre in the box at a fixed size.
        */}
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
      </summary>
      <div className="absolute right-0 z-20 mt-2 min-w-36 max-w-[calc(100vw-2rem)] rounded-md border border-[#E5E7EB] bg-white p-1 shadow-lg">
        <div className="grid gap-1">{children}</div>
      </div>
    </details>
  );
}
