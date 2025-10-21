import { serve } from "$std/http/server.ts";
import { CONFIG } from "shared/env.ts";
import { badRequest, methodNotAllowed, ok, serverError } from "shared/http.ts";

type ContactPayload = {
  id: string;
  tenant_id?: string;
  phone?: string;
  msisdn?: string;
  categories?: string[];
  region?: string;
  intent_payload?: Record<string, unknown>;
};

const AGENT_CORE_URL = CONFIG.AGENT_CORE_URL;
const AGENT_CORE_TOKEN = CONFIG.AGENT_CORE_TOKEN;
const DEFAULT_TENANT_ID = CONFIG.DEFAULT_TENANT_ID;

serve(async (req: Request) => {
  if (!AGENT_CORE_URL) return serverError("AGENT_CORE_URL not configured");
  if (req.method !== "POST") return methodNotAllowed(["POST"]);

  const body = (await req.json().catch(() => ({}))) as {
    contact?: ContactPayload;
  };
  const contact = body.contact;
  if (!contact?.id) return badRequest("missing_contact_payload");

  const msisdn = contact.msisdn ?? contact.phone;
  if (!msisdn) return badRequest("contact_missing_phone");

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

  const response = await fetch(
    `${AGENT_CORE_URL.replace(/\/$/, "")}/ai/tasks/schedule`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(AGENT_CORE_TOKEN
          ? { Authorization: `Bearer ${AGENT_CORE_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(schedulePayload),
    },
  );

  const data = await response.json().catch(() => ({}));
  return response.ok
    ? ok({ data })
    : serverError("agent_core_schedule_failed", { data });
});
