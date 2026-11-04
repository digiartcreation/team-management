"use server";

import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { passwordError } from "@/lib/passwords";

/** Returned to the change password form, which shows it inline. */
export type ChangePasswordState = { ok: true } | { error: string } | null;

function getRaw(formData: FormData, key: string) {
  const value = formData.get(key);
  // Not trimmed: a space can be part of a password.
  return typeof value === "string" ? value : "";
}

/**
 * The signed-in person's own password: only with the current one, so a
 * session left open on someone's desk cannot be used to take the account.
 */
export async function changeOwnPassword(
  _previous: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return { error: "Sign in again to change your password." };
  }

  const current = getRaw(formData, "currentPassword");
  const next = getRaw(formData, "newPassword");
  const confirm = getRaw(formData, "confirmPassword");

  if (!current || !next || !confirm) {
    return { error: "Fill in all three fields." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });

  if (!user || !(await bcrypt.compare(current, user.password))) {
    return { error: "Your current password is not right." };
  }

  const weakPassword = passwordError(next);

  if (weakPassword) {
    return { error: weakPassword };
  }

  if (next !== confirm) {
    return { error: "The new password and its confirmation do not match." };
  }

  if (await bcrypt.compare(next, user.password)) {
    return { error: "Choose a password different from the current one." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { password: await bcrypt.hash(next, 10) },
  });
  await logActivity({
    userId,
    action: "updated",
    entityType: "profile",
    entityId: userId,
    description: "Changed their password",
  });

  return { ok: true };
}
