"use client";

import { useRef, useState } from "react";

type TextareaWithBulletProps = {
  name: string;
  id?: string;
  defaultValue?: string;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  className?: string;
};

/**
 * A text box with an Add bullet button and a running character count under
 * it. There is no length limit; the count is only there to show how much has
 * been written.
 */
export default function TextareaWithBullet({
  name,
  id,
  defaultValue = "",
  placeholder,
  rows = 3,
  required,
  className,
}: TextareaWithBulletProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [count, setCount] = useState(defaultValue.length);

  function addBullet() {
    const textarea = ref.current;

    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const prefix = start > 0 && value[start - 1] !== "\n" ? "\n" : "";
    const insertion = `${prefix}• `;
    textarea.value = `${value.slice(0, start)}${insertion}${value.slice(end)}`;
    const cursor = start + insertion.length;
    textarea.focus();
    textarea.setSelectionRange(cursor, cursor);
    setCount(textarea.value.length);
  }

  return (
    <div className="grid gap-1.5">
      <textarea
        ref={ref}
        id={id}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        rows={rows}
        required={required}
        onInput={(event) => setCount(event.currentTarget.value.length)}
        className={
          className ??
          "w-full resize-y rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-gray-900 shadow-sm placeholder:text-gray-400"
        }
      />
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={addBullet}
          className="inline-flex w-fit items-center gap-1.5 rounded-md border border-[#A05DD0]/40 bg-white px-2.5 py-1 text-xs font-medium text-[#770FC2] transition hover:bg-[#F3E8FF]"
        >
          <svg aria-hidden viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="4.5" cy="6" r="1" fill="currentColor" />
            <circle cx="4.5" cy="14" r="1" fill="currentColor" />
            <path d="M8.5 6h8M8.5 14h8" strokeLinecap="round" />
          </svg>
          Add bullet
        </button>
        <span className="text-xs tabular-nums text-gray-400">
          {count.toLocaleString("en-IN")} {count === 1 ? "character" : "characters"}
        </span>
      </div>
    </div>
  );
}
