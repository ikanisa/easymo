import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptField, hashField, maskMsisdn, maskNationalId } from "../_shared/crypto.ts";
import { enforceRateLimit } from "../_shared/rate-limit.ts";
import { writeAuditLog } from "../_shared/audit.ts";
import { recordMetric } from "../_shared/metrics.ts";
import { serveWithObservability } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MemberPayload {
  fullName: string;
  msisdn: string;
  nationalId?: string | null;
  memberCode?: string | null;
}

interface ImportRequest {
  ikiminaId: string;
  members: MemberPayload[];
}

const AUTHORIZED_ROLES = new Set(["SYSTEM_ADMIN", "SACCO_MANAGER", "SACCO_STAFF"]);

const normalizeMsisdn = (value: string) => {
  const digits = value.replace(/[^0-9+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("2507")) return `+${digits}`;
  if (digits.startsWith("07")) return `+250${digits.slice(2)}`;
  return value;
};

serveWithObservability("secure-import-members", async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase credentials");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization header" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    // Service client (for privileged reads/writes) and user-scoped client (to read current user)
    const serviceClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const userClient = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authHeader } },
    });

    const payload = (await req.json()) as ImportRequest;
    if (!payload.ikiminaId || !payload.members?.length) {
      throw new Error("Ikimina ID and members are required");
    }

    // Who is calling?
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Load requester profile and enforce role
    const { data: requesterProfile, error: profileError } = await serviceClient
      .from("users")
      .select("id, role, sacco_id")
      .eq("id", user.id)
      .single();

    if (profileError || !requesterProfile || !AUTHORIZED_ROLES.has(requesterProfile.role)) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Target ikimina and sacco alignment
    const { data: ikimina, error: ikiminaError } = await serviceClient
      .from("ibimina")
      .select("id, sacco_id")
      .eq("id", payload.ikiminaId)
      .single();

    if (ikiminaError || !ikimina) {
      return new Response(JSON.stringify({ success: false, error: "Ikimina not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    const isSystemAdmin = requesterProfile.role === "SYSTEM_ADMIN";
    const isSameSacco =
      Boolean(requesterProfile.sacco_id) && requesterProfile.sacco_id === ikimina.sacco_id;
    const hasSaccoPrivileges =
      requesterProfile.role === "SACCO_MANAGER" || requesterProfile.role === "SACCO_STAFF";

    if (!isSystemAdmin && !(isSameSacco && hasSaccoPrivileges)) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Rate limit keyed to ikimina
    const allowed = await enforceRateLimit(serviceClient, `members:${payload.ikiminaId}`, {
      maxHits: Math.max(payload.members.length, 10),
    });
    if (!allowed) {
      return new Response(JSON.stringify({ success: false, error: "Rate limit exceeded" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      });
    }

    // Prepare rows
    const records: Record<string, unknown>[] = [];
    for (const member of payload.members) {
      const msisdn = normalizeMsisdn(member.msisdn);
      const encryptedMsisdn = await encryptField(msisdn);
      const msisdnHash = await hashField(msisdn);
      const maskedMsisdn = maskMsisdn(msisdn);

      const nationalId = member.nationalId?.trim() || null;
      const encryptedNid = await encryptField(nationalId ?? null);
      const nidHash = await hashField(nationalId ?? null);
      const maskedNid = maskNationalId(nationalId ?? null);

      records.push({
        ikimina_id: payload.ikiminaId,
        full_name: member.fullName,
        member_code: member.memberCode ?? null,
        status: "ACTIVE",
        // store masked display + encrypted + hash
        msisdn: maskedMsisdn,
        msisdn_encrypted: encryptedMsisdn,
        msisdn_hash: msisdnHash,
        msisdn_masked: maskedMsisdn,
        national_id_encrypted: encryptedNid,
        national_id_hash: nidHash,
        national_id_masked: maskedNid,
      });
    }

    const { error: insertError } = await serviceClient.from("ikimina_members").insert(records);
    if (insertError) throw insertError;

    await writeAuditLog(serviceClient, {
      actorId: user.id,
      action: "MEMBER_IMPORT",
      entity: "IKIMINA",
      entityId: payload.ikiminaId,
      diff: { imported: records.length },
    });

    await recordMetric(serviceClient, "members_imported", records.length, {
      ikiminaId: payload.ikiminaId,
    });

    return new Response(JSON.stringify({ success: true, inserted: records.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("secure-import-members error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
