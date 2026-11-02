"use client";

import { useState, type InputHTMLAttributes } from "react";

/** A password box with a Show / Hide button, so a long one can be checked. */
export default function PasswordInput(
  props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">
) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className="w-full rounded-md border border-slate-300 py-2 pl-3 pr-16 text-sm outline-none transition focus:border-[#770FC2] focus:ring-2 focus:ring-[#770FC2]/20"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-[#770FC2] hover:text-[#5B0B96]"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
