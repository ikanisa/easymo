import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import {
  createServiceRoleClient,
  handleOptions,
  json,
  logRequest,
  logResponse,
  requireAdminAuth,
  withCors,
} from "../_shared/admin.ts";

const supabase = createServiceRoleClient();

const querySchema = z.object({
  action: z.string().optional().default("list"),
  limit: z.coerce.number().int().min(1).max(200).default(200),
});

const approveSchema = z.object({
  id: z.number().int().positive(),
  txn_id: z.string().max(64).optional(),
}).strict();

const rejectSchema = z.object({
  id: z.number().int().positive(),
}).strict();

async function listSubscriptions(limit: number) {
  const { data, error } = await supabase.from("subscriptions").select(
    "id,user_id,status,started_at,expires_at,amount,proof_url,created_at",
  ).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);

  const entries = data ?? [];

  const signedResults = await Promise.all(entries.map(async (sub) => {
    if (!sub.proof_url) return { id: sub.id, signedUrl: null };
    const { data: signed, error: signErr } = await supabase.storage
      .from("proofs")
      .createSignedUrl(sub.proof_url, 60 * 60 * 24 * 7);
    if (signErr) {
      console.warn("admin-subscriptions.sign_failed", {
        id: sub.id,
        error: signErr.message,
      });
      return { id: sub.id, signedUrl: null };
    }
    return { id: sub.id, signedUrl: signed.signedUrl };
  }));

  const signedMap = new Map(signedResults.map((r) => [r.id, r.signedUrl]));

  return entries.map((sub) => ({
    ...sub,
    proof_url_signed: signedMap.get(sub.id) ?? null,
  }));
}

async function approveSubscription(id: number, txnId?: string) {
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const update = {
    status: "active",
    started_at: now.toISOString(),
    expires_at: expires.toISOString(),
    txn_id: txnId ?? null,
    updated_at: now.toISOString(),
  };
  const { error } = await supabase.from("subscriptions")
    .update(update)
    .eq("id", id)
    .in("status", ["pending", "review"])
    .select("id");
  if (error) throw new Error(error.message);
}

async function rejectSubscription(id: number) {
  const { error } = await supabase.from("subscriptions")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["pending", "review"])
    .select("id");
  if (error) throw new Error(error.message);
}

Deno.serve(async (req) => {
  logRequest("admin-subscriptions", req);

  if (req.method === "OPTIONS") {
    return handleOptions();
  }

  const authResponse = requireAdminAuth(req);
  if (authResponse) return authResponse;

  try {
    if (req.method === "GET") {
      const query = querySchema.parse(
        Object.fromEntries(new URL(req.url).searchParams),
      );
      if (query.action !== "list") {
        return json({ error: "invalid_action" }, 400);
      }
      const subscriptions = await listSubscriptions(query.limit);
      logResponse("admin-subscriptions", 200, { count: subscriptions.length });
      return new Response(
        JSON.stringify({ subscriptions }),
        withCors({ status: 200 }),
      );
    }

    if (req.method === "POST") {
      const action = (new URL(req.url).searchParams.get("action") ?? "")
        .toLowerCase();
      const payload = await req.json().catch(() => {
        throw new Error("invalid_json");
      });

      if (action === "approve") {
        const { id, txn_id } = approveSchema.parse(payload);
        await approveSubscription(id, txn_id);
        logResponse("admin-subscriptions", 200, { action, id });
        return json({ success: true });
      }
      if (action === "reject") {
        const { id } = rejectSchema.parse(payload);
        await rejectSubscription(id);
        logResponse("admin-subscriptions", 200, { action, id });
        return json({ success: true });
      }
      return json({ error: "invalid_action" }, 400);
    }

    return json({ error: "method_not_allowed" }, 405);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return json({ error: "invalid_payload" }, 400);
    }
    if (error instanceof Error && error.message === "invalid_json") {
      return json({ error: "invalid_json" }, 400);
    }
    console.error("admin-subscriptions.unhandled", error);
    return json({ error: "internal_error" }, 500);
  }
});
