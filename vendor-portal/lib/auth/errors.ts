const DEFAULT_MESSAGE = "Something went wrong. Try again.";

export type AuthErrorPayload = {
  status?: number;
  message?: string;
};

/**
 * Maps Supabase auth errors into user-friendly copy while avoiding leaking internal codes.
 */
export function mapAuthError(
  error: AuthErrorPayload | null | undefined,
  fallback = DEFAULT_MESSAGE
) {
  if (!error) {
    return fallback;
  }

  const normalizedStatus = error.status ?? null;
  const normalizedMessage = (error.message || "").trim();

  if (normalizedStatus === 400 || normalizedStatus === 401) {
    return "Email or password was incorrect.";
  }

  if (normalizedStatus === 403) {
    return normalizedMessage || "Your account is not permitted to sign in.";
  }

  if (normalizedMessage.length > 0) {
    return normalizedMessage;
  }

  return fallback;
}
