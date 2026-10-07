"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = Omit<ComponentProps<"button">, "type"> & {
  /** Shown beside the spinner while the form's action is running. */
  pendingLabel?: ReactNode;
};

/**
 * A form's submit button that shows a spinner and locks itself while the
 * action runs, so a slow save cannot be sent twice. Must sit inside the <form>.
 */
export default function SubmitButton({
  children,
  pendingLabel,
  disabled,
  className,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      {...props}
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className={`inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70 ${className ?? ""}`}
    >
      {pending ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {pending ? pendingLabel ?? children : children}
    </button>
  );
}
