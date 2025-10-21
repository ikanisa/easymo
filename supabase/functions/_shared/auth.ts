import { unauthorized } from "shared/http.ts";
import { getAdminToken } from "shared/env.ts";

export function requireAdmin(req: Request): Response | null {
  const token = getAdminToken();
  const header = req.headers.get("x-api-key");
  if (!token || header !== token) return unauthorized();
  return null;
}
