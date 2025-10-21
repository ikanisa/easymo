import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type ContactPayload = {
  id: string;
  tenant_id?: string;
  phone?: string;
  msisdn?: string;
  categories?: string[];
  region?: string;
  intent_payload?: Record<string, unknown>;
};

const AGENT_CORE_URL = Deno.env.get("AGENT_CORE_URL");
const AGENT_CORE_TOKEN = Deno.env.get("AGENT_CORE_TOKEN" ?? "");
const DEFAULT_TENANT_ID = Deno.env.get("AGENT_CORE_TENANT_ID");

serve(async (req: Request) => {
  if (!AGENT_CORE_URL) {
    return new Response(JSON.stringify({ error: "AGENT_CORE_URL not configured" }), { status: 500 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = (await req.json().catch(() => ({}))) as { contact?: ContactPayload };
  const contact = body.contact;
  if (!contact?.id) {
    return new Response(JSON.stringify({ error: "Missing contact payload" }), { status: 400 });
  }

  const msisdn = contact.msisdn ?? contact.phone;
  if (!msisdn) {
    return new Response(JSON.stringify({ error: "Contact missing phone" }), { status: 400 });
  }

  const schedulePayload = {
    tenantId: contact.tenant_id ?? DEFAULT_TENANT_ID,
    contactRef: contact.id,
    type: "VOICE_COLD_CALL",
    payload: {
      msisdn,
      tenantId: contact.tenant_id ?? DEFAULT_TENANT_ID,
      contactName: contact.id,
      categories: contact.categories ?? [],
      intentPayload: contact.intent_payload ?? {},
    },
  };

  const response = await fetch(`${AGENT_CORE_URL.replace(/\/$/, "")}/ai/tasks/schedule`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(AGENT_CORE_TOKEN ? { Authorization: `Bearer ${AGENT_CORE_TOKEN}` } : {}),
    },
    body: JSON.stringify(schedulePayload),
  });

  const data = await response.json().catch(() => ({}));
  return new Response(JSON.stringify({ ok: response.ok, data }), {
    headers: { "Content-Type": "application/json" },
    status: response.ok ? 200 : 500,
  });
});

