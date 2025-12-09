import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Session } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getSupabaseConfigStatus } from "@/lib/supabase/config";
import { logError, logWarn } from "@/lib/observability/logger";

type AuthCallbackPayload = {
  event: string;
  session: Session | null;
};

export async function POST(request: NextRequest) {
  const config = getSupabaseConfigStatus();

  if (!config.hasUrl || !config.hasAnonKey) {
    logError("supabase_config_missing", {
      hasUrl: config.hasUrl,
      hasAnonKey: config.hasAnonKey,
    });

    return NextResponse.json({ error: "supabase_not_configured" }, { status: 500 });
  }

  const requestCookies = await cookies();
  const response = NextResponse.json({ success: true });

  const supabase = createServerClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return requestCookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  let payload: AuthCallbackPayload | null = null;
  try {
    payload = (await request.json()) as AuthCallbackPayload;
  } catch (error) {
    logError("json_parse_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (!payload?.event) {
    logWarn("missing_event", {
      hasSession: Boolean(payload?.session),
    });
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (payload.event === "SIGNED_OUT") {
    const { error } = await supabase.auth.signOut();
    if (error) {
      logError("signout_failed", {
        message: error.message,
        status: error.status,
        name: error.name,
      });
      return NextResponse.json({ error: "signout_failed" }, { status: 500 });
    }

    return response;
  }

  if (!payload.session) {
    logWarn("missing_session", { event: payload.event });
    return NextResponse.json({ error: "missing_session" }, { status: 400 });
  }

  const { error } = await supabase.auth.setSession(payload.session);
  if (error) {
    logError("set_session_failed", {
      message: error.message,
      status: error.status,
      name: error.name,
    });
    return NextResponse.json({ error: "session_persist_failed" }, { status: 500 });
  }

  return response;
}
