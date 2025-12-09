import { NextResponse } from "next/server";
import { logError } from "@/lib/observability/logger";

import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const extractVisibility = (prefs: unknown, path: string): boolean | null => {
  if (!isRecord(prefs)) {
    return null;
  }
  const assistant = prefs.assistant;
  if (!isRecord(assistant)) {
    return null;
  }
  const routes = assistant.routes;
  if (!isRecord(routes)) {
    return null;
  }
  const value = routes[path];
  return typeof value === "boolean" ? value : null;
};

const mergeVisibility = (prefs: unknown, path: string, visible: boolean): Json => {
  const base = isRecord(prefs) ? { ...prefs } : {};
  const assistant = isRecord(base.assistant) ? { ...base.assistant } : {};
  const routes = isRecord(assistant.routes) ? { ...assistant.routes } : {};
  routes[path] = visible;
  assistant.routes = routes;
  assistant.updated_at = new Date().toISOString();
  base.assistant = assistant;
  return base as Json;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  try {
    const { user } = await requireUserAndProfile();
    const supabase = await createSupabaseServerClient();
    // Cast to any since user_preferences table not in generated types
    const result = await (supabase as any)
      .from("user_preferences")
      .select("preferences")
      .eq("user_id", user.id)
      .maybeSingle();
    const { data, error } = result as { data: { preferences: unknown } | null; error: any };

    if (error) {
      logError("[assistant] Failed to load preferences", error);
      return NextResponse.json({ error: "Failed to load preferences" }, { status: 500 });
    }

    const visible = extractVisibility(data?.preferences ?? null, path);
    return NextResponse.json({ visible });
  } catch (error) {
    logError("[assistant] Preferences lookup failed", error);
    return NextResponse.json({ error: "Unable to read preferences" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const path = typeof payload.path === "string" ? payload.path : null;
    const visible = typeof payload.visible === "boolean" ? payload.visible : null;

    if (!path || visible === null) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { user } = await requireUserAndProfile();
    const supabase = await createSupabaseServerClient();

    // Cast to any since user_preferences table not in generated types
    const result1 = await (supabase as any)
      .from("user_preferences")
      .select("id, preferences")
      .eq("user_id", user.id)
      .maybeSingle();
    const { data: existing, error: fetchError } = result1 as {
      data: { id: string; preferences: unknown } | null;
      error: any;
    };

    if (fetchError && fetchError.code !== "PGRST116") {
      logError("[assistant] Failed to load existing preferences", fetchError);
      return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
    }

    const preferences = mergeVisibility(existing?.preferences ?? null, path, visible);

    // Cast to any since user_preferences table not in generated types
    const result2 = await (supabase as any).from("user_preferences").upsert(
      {
        id: existing?.id,
        user_id: user.id,
        preferences,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    const { error: upsertError } = result2 as { error: any };

    if (upsertError) {
      logError("[assistant] Failed to persist preferences", upsertError);
      return NextResponse.json({ error: "Failed to persist preferences" }, { status: 500 });
    }

    return NextResponse.json({ visible });
  } catch (error) {
    logError("[assistant] Failed to persist assistant preferences", error);
    return NextResponse.json({ error: "Failed to persist preferences" }, { status: 500 });
  }
}
