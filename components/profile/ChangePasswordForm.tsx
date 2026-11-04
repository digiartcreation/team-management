"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { changeOwnPassword } from "@/app/profile/actions";
import PasswordInput from "@/components/ui/PasswordInput";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwords";

export default function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(changeOwnPassword, null);
  const [, startSubmit] = useTransition();

  // Cleared once saved, so the new password does not sit on screen.
  useEffect(() => {
    if (state && "ok" in state) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        // Sent by hand rather than through `action`, after which React
        // clears the form: a mistyped current password would wipe the new
        // one along with it.
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startSubmit(() => formAction(formData));
      }}
      className="grid gap-4"
    >
      <label className="grid gap-1.5">
        <span className="text-sm font-medium text-slate-700">Current password</span>
        <PasswordInput name="currentPassword" required autoComplete="current-password" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-slate-700">New password</span>
          <PasswordInput
            name="newPassword"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-slate-700">Confirm new password</span>
          <PasswordInput name="confirmPassword" required autoComplete="new-password" />
        </label>
      </div>
      <p className="-mt-2 text-xs text-slate-500">
        At least {MIN_PASSWORD_LENGTH} characters.
      </p>

      {state && "error" in state ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state && "ok" in state ? (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Password changed. Use the new one next time you sign in.
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-[#770FC2] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#6B1BBD] disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Change password"}
        </button>
      </div>
    </form>
  );
}
