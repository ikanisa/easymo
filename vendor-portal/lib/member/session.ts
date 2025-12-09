import { redirect } from "next/navigation";
import { logError } from "@/lib/observability/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface MemberSession {
  id: string;
  email: string | null;
}

export async function getMemberSession(): Promise<MemberSession | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    logError("Failed to resolve member session", error);
    throw new Error("Unable to verify session");
  }

  if (!user) {
    return null;
  }

  return { id: user.id, email: user.email ?? null };
}

export async function requireMemberSession(): Promise<MemberSession> {
  const session = await getMemberSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}
