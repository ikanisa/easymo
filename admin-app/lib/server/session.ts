import { cookies } from "next/headers";
import type { SessionClaims } from "@/lib/auth/session-token";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session-token";
import { getActorLabel, isActorAuthorized } from "@/lib/auth/credentials";

export type AdminSession = SessionClaims & { label: string | null };

export async function readSessionFromCookies(): Promise<AdminSession | null> {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  if (!sessionCookie?.value) {
    return null;
  }

  const claims = await verifySessionToken(sessionCookie.value);
  if (!claims) {
    return null;
  }

  if (!isActorAuthorized(claims.sub)) {
    return null;
  }

  return { ...claims, label: getActorLabel(claims.sub) };
}
