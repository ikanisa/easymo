import { serve } from "../wa-webhook/deps.ts";
import { supabase, WA_BOT_NUMBER_E164 } from "../wa-webhook/config.ts";
import { logStructuredEvent } from "../wa-webhook/observe/log.ts";

const DEFAULT_ALLOWED_ORIGINS = (Deno.env.get("DEEPLINK_ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function buildCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = DEFAULT_ALLOWED_ORIGINS.length
    ? DEFAULT_ALLOWED_ORIGINS
    : ["*"];
  const headerOrigin = allowed.includes("*")
    ? "*"
    : (origin && allowed.includes(origin) ? origin : allowed[0]);
  return {
    "Access-Control-Allow-Origin": headerOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  };
}

function normalizeToken(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().toUpperCase();
  if (!cleaned) return null;
  const match = cleaned.match(/(?:JB[:\-])?([A-Z0-9]{4,})/);
  return match ? match[1] : null;
}

function formatShareCode(token: string): string {
  return token.startsWith("JB:") ? token : `JB:${token}`;
}

function buildWaLink(token: string): string | null {
  const digitsOnly = WA_BOT_NUMBER_E164.replace(/[^0-9]/g, "");
  if (!digitsOnly) return null;
  const shareCode = formatShareCode(token);
  return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(shareCode)}`;
}

async function incrementResolveStats(inviteId: string, current: number) {
  const { error } = await supabase
    .from("basket_invites")
    .update({
      resolved_count: current + 1,
      last_resolved_at: new Date().toISOString(),
    })
    .eq("id", inviteId);
  if (error) {
    console.error("deeplink.resolve_stats_failed", error);
  }
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = buildCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  let rawToken: unknown;
  if (req.method === "GET") {
    const url = new URL(req.url);
    rawToken = url.searchParams.get("token");
  } else if (req.method === "POST") {
    try {
      const body = await req.json();
      rawToken = body?.token;
    } catch (_error) {
      return new Response(
        JSON.stringify({ ok: false, error: "invalid_json" }),
        {
          status: 400,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }
  } else {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const token = normalizeToken(rawToken);
  if (!token) {
    const body = JSON.stringify({ ok: false, error: "token_required" });
    if (req.method === "GET") {
      return new Response(body, {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    return new Response(body, {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const { data: invite, error } = await supabase
    .from("basket_invites")
    .select("id, token, status, expires_at, resolved_count")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    console.error("deeplink.lookup_failed", error);
    return new Response(
      JSON.stringify({ ok: false, error: "lookup_failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  }

  if (!invite) {
    return new Response(
      JSON.stringify({ ok: false, error: "invite_not_found" }),
      {
        status: 404,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  }

  if (invite.status !== "active") {
    return new Response(
      JSON.stringify({ ok: false, error: "invite_inactive" }),
      {
        status: invite.status === "used" ? 409 : 410,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  }

  if (invite.expires_at) {
    const expiry = new Date(invite.expires_at);
    if (!Number.isNaN(expiry.getTime()) && expiry.getTime() < Date.now()) {
      await supabase
        .from("basket_invites")
        .update({ status: "expired" })
        .eq("id", invite.id);
      return new Response(
        JSON.stringify({ ok: false, error: "invite_expired" }),
        {
          status: 410,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }
  }

  await incrementResolveStats(invite.id, invite.resolved_count ?? 0);

  const shareCode = formatShareCode(token);
  const waLink = buildWaLink(token);

  await logStructuredEvent("DEEPLINK_RESOLVED", {
    invite_id: invite.id,
    has_wa_link: Boolean(waLink),
  });

  if (req.method === "POST") {
    return new Response(
      JSON.stringify({
        ok: true,
        share_code: shareCode,
        wa_link: waLink,
        expires_at: invite.expires_at,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  }

  if (waLink) {
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: waLink },
    });
  }

  return new Response(
    JSON.stringify({ ok: true, share_code: shareCode }),
    {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    },
  );
});
