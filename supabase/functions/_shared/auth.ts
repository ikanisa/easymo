import { unauthorized } from "./http.ts";
import { getAdminToken } from "./env.ts";

export function requireAdmin(req: Request): Response | null {
  const token = getAdminToken();
  const candidates = [
    req.headers.get("x-api-key"),
    req.headers.get("x-admin-token"),
  ];
  if (!token || !candidates.some((v) => v && v === token)) {
    return unauthorized();
  }
  return null;
}
