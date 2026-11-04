"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { resetEmployeePassword } from "@/app/employees/actions";
import MenuActionButton from "@/components/ui/MenuActionButton";
import PasswordInput from "@/components/ui/PasswordInput";
import { useActionMenu } from "@/components/ui/ActionMenu";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwords";

/**
 * Reset password, in an employee's row menu: a dialog where an admin sets a
 * new password for someone who cannot sign in. In the browser's top layer,
 * like the other dialogs raised from a row menu.
 */
export default function ResetPasswordButton({
  employeeId,
  employeeName,
}: {
  employeeId: string;
  employeeName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <MenuActionButton onClick={() => setOpen(true)}>Reset password</MenuActionButton>
      {open ? (
        <ResetPasswordDialog
          employeeId={employeeId}
          employeeName={employeeName}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function ResetPasswordDialog({
  employeeId,
  employeeName,
  onClose,
}: {
  employeeId: string;
  employeeName: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menu = useActionMenu();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();
  const headingId = `reset-password-${employeeId}`;

  useEffect(() => {
    const dialog = dialogRef.current;

    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  function close() {
    onClose();
    // Finished with the row: the menu goes too.
    menu?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={close}
      aria-labelledby={headingId}
      className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-lg border border-slate-200 bg-white p-6 text-left shadow-xl backdrop:bg-slate-950/40"
    >
      <h2 id={headingId} className="text-lg font-semibold text-slate-950">
        Reset password
      </h2>
      <p className="mt-1 break-words text-sm text-slate-500">{employeeName}</p>

      {done ? (
        <div className="mt-4 grid gap-4">
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Password reset. Share the new password with {employeeName}; they
            can change it on My Profile after signing in.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={close}
              className="rounded-md bg-[#770FC2] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#6B1BBD]"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            startTransition(async () => {
              const result = await resetEmployeePassword(employeeId, password, confirm);

              if (result && "error" in result) {
                setError(result.error);
              } else {
                setDone(true);
              }
            });
          }}
          className="mt-4 grid gap-4"
        >
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-slate-700">New password</span>
            <PasswordInput
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              autoFocus
            />
            <span className="text-xs text-slate-500">
              At least {MIN_PASSWORD_LENGTH} characters.
            </span>
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-slate-700">Confirm new password</span>
            <PasswordInput
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
              autoComplete="new-password"
            />
          </label>

          {error ? (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={close}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-[#770FC2] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#6B1BBD] disabled:opacity-60"
            >
              {isPending ? "Resetting..." : "Reset password"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
