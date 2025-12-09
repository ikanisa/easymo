import type { PostgrestError } from "@supabase/supabase-js";

type PostgrestShape = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

export function isMissingRelationError(error: unknown): error is PostgrestError {
  if (!error || typeof error !== "object") return false;
  const candidate = error as PostgrestShape;
  if (typeof candidate.code === "string" && ["PGRST200", "PGRST205"].includes(candidate.code)) {
    return true;
  }
  if (candidate.code === "42P01") return true;
  const fingerprint = [candidate.message, candidate.details, candidate.hint]
    .filter(Boolean)
    .join(" ");
  return /(?:relation|table).+does not exist/i.test(fingerprint);
}
