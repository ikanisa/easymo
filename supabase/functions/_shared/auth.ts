import { unauthorized } from "shared/http.ts";
import { getAdminToken, getAgentToolToken } from "shared/env.ts";

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

type AgentTokenValidation =
  | { ok: true }
  | { ok: false; reason: "missing_token" | "invalid_token" };

function extractAuthHeaderToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [scheme, ...rest] = header.split(" ");
  if (!scheme) return null;
  if (scheme.toLowerCase() === "bearer" && rest.length > 0) {
    return rest.join(" ").trim();
  }
  return header.trim();
}

function getAgentTokenCandidates(req: Request): string[] {
  const candidates = [
    extractAuthHeaderToken(req),
    req.headers.get("x-agent-jwt"),
    req.headers.get("x-agent-token"),
    req.headers.get("x-admin-token"),
    req.headers.get("x-api-key"),
  ];
  return candidates.filter((value): value is string => !!value && value.length > 0);
}

export function validateAgentToolRequest(req: Request): AgentTokenValidation {
  const expected = getAgentToolToken();
  if (!expected) {
    return { ok: false, reason: "missing_token" };
  }

  const candidates = getAgentTokenCandidates(req);
  if (candidates.some((token) => token === expected)) {
    return { ok: true };
  }

  return { ok: false, reason: "invalid_token" };
}
