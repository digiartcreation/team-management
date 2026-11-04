/** The shortest password an account may have. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * bcrypt only reads the first 72 bytes of a password, so anything longer
 * would quietly sign in with just its start. Refused instead.
 */
const MAX_PASSWORD_BYTES = 72;

/** Why a new password cannot be used, or null when it can. */
export function passwordError(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return "Password is too long; keep it under 72 characters.";
  }

  return null;
}
