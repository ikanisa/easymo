import { z } from "zod";
import { createServiceClient, errorResponse, jsonResponse, parseJwt } from "../_shared/mod.ts";
import { enforceIdentityRateLimit } from "../_shared/rate-limit.ts";
import { writeAuditLog } from "../_shared/audit.ts";
import { recordMetric } from "../_shared/metrics.ts";
import { postToLedger } from "../_shared/ledger.ts";
import { serveWithObservability } from "../_shared/observability.ts";

const actionSchema = z.object({
  paymentId: z.string().uuid(),
  action: z.enum(["ASSIGN", "APPROVE", "REJECT"]),
  ikiminaId: z.string().uuid().optional(),
  memberId: z.string().uuid().optional(),
  note: z.string().max(500).optional(),
});

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

const withCors = (response: Response) => {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    headers,
  });
};

const loadProfile = async (supabase: ReturnType<typeof createServiceClient>, userId: string) => {
  const { data, error } = await supabase
    .schema("app")
    .from("user_profiles")
    .select("sacco_id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
};

const handleGet = async (req: Request) => {
  try {
    const auth = parseJwt(req.headers.get("authorization"));
    const supabase = createServiceClient();

    if (!auth.userId) {
      return withCors(errorResponse("Missing identity", 401));
    }

    const profile = await loadProfile(supabase, auth.userId);
    if (!profile?.sacco_id && profile?.role !== "SYSTEM_ADMIN") {
      return withCors(errorResponse("Profile missing SACCO assignment", 403));
    }

    const saccoFilter = profile?.role === "SYSTEM_ADMIN" ? undefined : profile?.sacco_id;

    let query = supabase
      .schema("app")
      .from("recon_exceptions")
      .select(
        `id, reason, status, note, created_at, payment:payments(id, sacco_id, status, amount, currency, reference, occurred_at, ikimina_id, member_id)`
      )
      .eq("status", "OPEN")
      .order("created_at", { ascending: false });

    if (saccoFilter) {
      query = query.eq("payment.sacco_id", saccoFilter);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return withCors(jsonResponse({ items: data ?? [] }));
  } catch (error) {
    console.error("recon-exceptions GET error", error);
    return withCors(errorResponse("Unhandled error", 500));
  }
};

const handlePost = async (req: Request) => {
  try {
    const payload = actionSchema.parse(await req.json());
    const auth = parseJwt(req.headers.get("authorization"));
    const supabase = createServiceClient();

    if (!auth.userId) {
      return withCors(errorResponse("Missing identity", 401));
    }

    const rateAllowed = await enforceIdentityRateLimit(supabase, auth.userId, "/recon/exceptions", {
      maxHits: 40,
      windowSeconds: 60,
    });

    if (!rateAllowed) {
      return withCors(errorResponse("Rate limit exceeded", 429));
    }

    const profile = await loadProfile(supabase, auth.userId);
    const actingRole = profile?.role ?? auth.role;

    if (actingRole !== "SYSTEM_ADMIN" && !profile?.sacco_id) {
      return withCors(errorResponse("Profile missing SACCO assignment", 403));
    }

    const { data: payment, error: paymentError } = await supabase
      .schema("app")
      .from("payments")
      .select("id, sacco_id, status, amount, currency, txn_id, ikimina_id, member_id")
      .eq("id", payload.paymentId)
      .maybeSingle();

    if (paymentError) {
      throw paymentError;
    }

    if (!payment) {
      return withCors(errorResponse("Payment not found", 404));
    }

    if (actingRole !== "SYSTEM_ADMIN" && payment.sacco_id !== profile?.sacco_id) {
      return withCors(errorResponse("Forbidden", 403));
    }

    const { data: exception, error: exceptionError } = await supabase
      .schema("app")
      .from("recon_exceptions")
      .select("id, status")
      .eq("payment_id", payload.paymentId)
      .eq("status", "OPEN")
      .maybeSingle();

    if (exceptionError) {
      throw exceptionError;
    }

    if (!exception) {
      return withCors(errorResponse("No open exception", 404));
    }

    let nextStatus = payment.status;
    let ikiminaId = payment.ikimina_id as string | null;
    let memberId = payment.member_id as string | null;

    if (payload.action === "ASSIGN") {
      if (!payload.ikiminaId) {
        return withCors(errorResponse("ikiminaId required for ASSIGN", 422));
      }
      ikiminaId = payload.ikiminaId;
      memberId = payload.memberId ?? null;
      nextStatus = payload.memberId ? "POSTED" : "UNALLOCATED";

      const updatePayment = await supabase
        .schema("app")
        .from("payments")
        .update({
          ikimina_id: ikiminaId,
          member_id: memberId,
          status: nextStatus,
        })
        .eq("id", payment.id)
        .select("id")
        .single();

      if (updatePayment.error) {
        throw updatePayment.error;
      }

      await supabase
        .schema("app")
        .from("recon_exceptions")
        .update({
          note: payload.note ?? null,
        })
        .eq("id", exception.id);
    } else {
      const resolvedStatus = payload.action === "APPROVE" ? "POSTED" : "REJECTED";
      nextStatus = resolvedStatus;

      const updatePayment = await supabase
        .schema("app")
        .from("payments")
        .update({
          status: resolvedStatus,
          ikimina_id: payload.ikiminaId ?? payment.ikimina_id,
          member_id: payload.memberId ?? payment.member_id,
        })
        .eq("id", payment.id)
        .select("id, ikimina_id, member_id")
        .single();

      if (updatePayment.error) {
        throw updatePayment.error;
      }

      ikiminaId = updatePayment.data.ikimina_id as string | null;
      memberId = updatePayment.data.member_id as string | null;

      await supabase
        .schema("app")
        .from("recon_exceptions")
        .update({
          status: "RESOLVED",
          note: payload.note ?? null,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", exception.id);
    }

    if (nextStatus === "POSTED" && ikiminaId) {
      await postToLedger(supabase, {
        id: payment.id as string,
        sacco_id: payment.sacco_id as string,
        ikimina_id: ikiminaId,
        member_id: memberId,
        amount: payment.amount as number,
        currency: payment.currency as string,
        txn_id: payment.txn_id as string,
      });
    }

    await writeAuditLog(supabase, {
      action: `RECON_${payload.action}`,
      saccoId: payment.sacco_id as string,
      entity: "PAYMENT",
      entityId: payment.id as string,
      actorId: auth.userId,
      diff: {
        status: nextStatus,
        ikiminaId,
        memberId,
        note: payload.note ?? null,
      },
    });

    await recordMetric(supabase, "recon_action", 1, {
      saccoId: payment.sacco_id,
      action: payload.action,
    });

    return withCors(
      jsonResponse({
        paymentId: payment.id,
        status: nextStatus,
      })
    );
  } catch (error) {
    console.error("recon-exceptions POST error", error);
    const status = error instanceof z.ZodError ? 400 : 500;
    const message = error instanceof z.ZodError ? "Invalid payload" : "Unhandled error";
    return withCors(errorResponse(message, status));
  }
};

serveWithObservability("recon-exceptions", async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return handleGet(req);
  }

  if (req.method === "POST") {
    return handlePost(req);
  }

  return withCors(errorResponse("Method not allowed", 405));
});
