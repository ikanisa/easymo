import type { RouterContext } from "../types.ts";
import type { ChatState } from "../state/store.ts";
import { setState } from "../state/store.ts";
import { sendText } from "../wa/client.ts";
import { logStructuredEvent } from "../observe/log.ts";
import { CONFIG } from "../../_shared/env.ts";

const FARMER_KEYWORDS = [
  /guhinga/i,
  /kugurisha/i,
  /amahangwa/i,
  /ibigori/i,
  /maize/i,
  /harvest/i,
  /tonnes?/i,
  /kg\b/i,
];

const BUYER_KEYWORDS = [
  /gura/i,
  /buyers?/i,
  /kigali/i,
  /deliver/i,
  /market/i,
  /supply/i,
  /pickup/i,
];

export type FarmerIntent = "farmer_supply" | "buyer_demand";

type FarmerProfile = {
  id?: string;
  locale?: string | null;
  metadata?: Record<string, unknown> | null;
};

type FarmRecord = {
  id?: string;
  farm_name?: string;
  district?: string | null;
  sector?: string | null;
  region?: string | null;
  hectares?: number | null;
  commodities?: string[] | null;
  certifications?: string[] | null;
  irrigation?: boolean | null;
  metadata?: Record<string, unknown> | null;
  farm_synonyms?: Array<{ phrase: string; locale?: string | null; category?: string | null }>;
};

type FarmerAgentResponse = {
  success: boolean;
  message?: string;
  locale?: string;
  responseId?: string;
};

export async function maybeHandleFarmerBroker(
  ctx: RouterContext,
  body: string,
  state: ChatState,
): Promise<boolean> {
  const trimmed = body.trim();
  if (!trimmed) return false;

  // Handle "0" to go back home when in farmer broker state
  if (trimmed === "0" && state.key === "ai_farmer_broker") {
    const { sendHomeMenu } = await import("../flows/home.ts");
    await sendHomeMenu(ctx);
    return true;
  }

  const messageIntent = intentFromMessage(trimmed, state);
  let profileData: { profile?: FarmerProfile; farm?: FarmRecord } | null = null;
  try {
    profileData = await fetchProfileAndFarm(ctx);
  } catch (error) {
    console.error("farmer_profile_fetch_error", error);
    return false;
  }
  const intent = messageIntent ?? intentFromMetadata(profileData?.profile?.metadata);
  if (!intent) {
    return false;
  }

  await logStructuredEvent("FARMER_AGENT_TRIGGERED", {
    from: ctx.from,
    intent,
    profileId: ctx.profileId,
  });

  try {
    const conversation = await ensureConversation(ctx, profileData?.profile?.id ?? null, intent);
    await saveAgentMessage(ctx, conversation.id, "user", trimmed);
    const agentResponse = await invokeFarmerBrokerAgent(ctx, conversation.id, intent, trimmed, profileData);

    const reply = agentResponse.message?.trim() ||
      "Murakoze! Twakiriye ubutumwa bwanyu. Tuzabagezaho ibisubizo by''isoko ryanyu bidatinze.";

    const { sendText } = await import("../wa/client.ts");
    await sendText(ctx.from, reply);
    await saveAgentMessage(ctx, conversation.id, "assistant", reply, { responseId: agentResponse.responseId });
    await ctx.supabase
      .from("agent_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        message_count: (conversation.message_count ?? 0) + 1,
        metadata: { intent },
      })
      .eq("id", conversation.id);

    await setState(ctx.supabase, ctx.profileId || ctx.from, {
      key: "ai_farmer_broker",
      data: { intent, conversationId: conversation.id },
    });

    return true;
  } catch (error) {
    console.error("farmer_broker_error", error);
    await logStructuredEvent("FARMER_AGENT_ERROR", {
      from: ctx.from,
      intent,
      error: error instanceof Error ? error.message : String(error),
    });
    await sendText(
      ctx.from,
      "Hari ikibazo habaye ubwo twageragezaga kuganira n''umufasha wacu. Ongera ugerageze mu kanya gake.",
    );
    return true;
  }
}

function intentFromMessage(body: string, state: ChatState): FarmerIntent | null {
  if (state.key === "ai_farmer_broker" && typeof state.data?.intent === "string") {
    return state.data.intent as FarmerIntent;
  }
  const normalized = body.toLowerCase();
  if (FARMER_KEYWORDS.some((regex) => regex.test(normalized))) {
    return "farmer_supply";
  }
  if (BUYER_KEYWORDS.some((regex) => regex.test(normalized))) {
    return "buyer_demand";
  }
  return null;
}

function intentFromMetadata(metadata?: Record<string, unknown> | null): FarmerIntent | null {
  if (!metadata || typeof metadata.farmer_profile !== "object") {
    return null;
  }
  const focus = (metadata.farmer_profile as Record<string, unknown>).distribution_focus;
  if (typeof focus === "string" && focus.toLowerCase().includes("buyer")) {
    return "buyer_demand";
  }
  if (typeof focus === "string" && focus.toLowerCase().includes("cooperative")) {
    return "farmer_supply";
  }
  return null;
}

async function fetchProfileAndFarm(ctx: RouterContext): Promise<{ profile?: FarmerProfile; farm?: FarmRecord } | null> {
  const profileQuery = ctx.profileId
    ? ctx.supabase.from("profiles").select("user_id, locale, metadata").eq("user_id", ctx.profileId).maybeSingle()
    : ctx.supabase.from("profiles").select("user_id, locale, metadata").eq("whatsapp_e164", ctx.from).maybeSingle();
  const profile = await profileQuery;
  if (profile.error && profile.error.code !== "PGRST116") {
    throw profile.error;
  }
  if (!profile.data) {
    return null;
  }
  const farm = await ctx.supabase
    .from("farms")
    .select("id, farm_name, district, sector, region, hectares, commodities, certifications, irrigation, metadata, farm_synonyms(phrase, locale, category)")
    .eq("owner_profile_id", profile.data.user_id)
    .maybeSingle();
  if (farm.error && farm.error.code !== "PGRST116") {
    throw farm.error;
  }
  return {
    profile: { id: profile.data.user_id, locale: profile.data.locale, metadata: profile.data.metadata as Record<string, unknown> },
    farm: farm.data ?? undefined,
  };
}

async function ensureConversation(ctx: RouterContext, profileId: string | null, intent: FarmerIntent) {
  const existing = await ctx.supabase
    .from("agent_conversations")
    .select("id, message_count")
    .eq("phone_number", ctx.from)
    .eq("agent_type", "farmer_broker")
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.data) {
    return existing.data;
  }
  const insert = await ctx.supabase
    .from("agent_conversations")
    .insert({
      phone_number: ctx.from,
      user_id: profileId,
      agent_type: "farmer_broker",
      status: "active",
      channel: "whatsapp",
      metadata: { intent },
    })
    .select("id, message_count")
    .single();
  if (insert.error) {
    throw insert.error;
  }
  return insert.data;
}

async function saveAgentMessage(
  ctx: RouterContext,
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  metadata?: Record<string, unknown>,
) {
  await ctx.supabase
    .from("agent_messages")
    .insert({
      conversation_id: conversationId,
      role,
      content,
      metadata: metadata ?? {},
    });
}

async function invokeFarmerBrokerAgent(
  ctx: RouterContext,
  conversationId: string,
  intent: FarmerIntent,
  message: string,
  context?: { profile?: FarmerProfile; farm?: FarmRecord | undefined } | null,
): Promise<FarmerAgentResponse> {
  const baseUrl = CONFIG.AGENT_CORE_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("AGENT_CORE_URL is not configured");
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Correlation-ID": crypto.randomUUID(),
  };
  if (CONFIG.AGENT_CORE_TOKEN) {
    headers.Authorization = `Bearer ${CONFIG.AGENT_CORE_TOKEN}`;
  }
  const response = await fetch(`${baseUrl}/ai/farmer-broker/run`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      msisdn: ctx.from,
      locale: ctx.locale,
      intent,
      conversationId,
      message,
      profile: context?.profile,
      farm: context?.farm,
      buyerContext: intent === "buyer_demand"
        ? { market: "kigali", requestedMessage: message }
        : undefined,
    }),
  });
  const body = await response.json().catch(() => ({ success: false }));
  if (!response.ok) {
    throw new Error(body?.error ?? "agent_core_error");
  }
  return body as FarmerAgentResponse;
}
