import type { RouterContext } from "../../types.ts";
import { t } from "../../i18n/translator.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import { sendText } from "../../wa/client.ts";
import { sendButtonsMessage, buildButtons } from "../../utils/reply.ts";
import { IDS } from "../../wa/ids.ts";
import { setState } from "../../state/store.ts";
import { WA_TOKEN, WA_PHONE_ID } from "../../config.ts";

const WAITER_AGENT_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/waiter-ai-agent`;
const ADMIN_INTERNAL_TOKEN = Deno.env.get("EASYMO_ADMIN_TOKEN") ?? "";

type WaiterChatSession = {
  conversationId: string;
  barId: string;
  barName: string;
  language: string;
};

async function postWaiterAgent(payload: Record<string, unknown>): Promise<Response> {
  return await fetch(WAITER_AGENT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Use internal admin token rather than service role for safer S2S auth
      "x-admin-token": ADMIN_INTERNAL_TOKEN,
    },
    body: JSON.stringify(payload),
  });
}

export async function startBarWaiterChat(
  ctx: RouterContext,
  detail: Record<string, unknown>,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const barId = typeof detail?.barId === "string" ? detail.barId : null;
  const barName = typeof detail?.barName === "string"
    ? detail.barName
    : t(ctx.locale, "bars.menu.unknown_name");
  if (!barId) {
    await sendText(
      ctx.from,
      t(ctx.locale, "bars.waiter.error"),
    );
    return true;
  }

  try {
    const response = await postWaiterAgent({
      action: "start_conversation",
      userId: ctx.profileId,
      language: ctx.locale,
      metadata: {
        venue: barId,
        venueName: barName,
        phoneNumber: ctx.from,
        countryCode: typeof detail?.barCountry === "string" ? detail.barCountry : undefined,
      },
    });

    if (!response.ok) {
      throw new Error(`waiter_start_failed_${response.status}`);
    }

    const data = await response.json();
    const session: WaiterChatSession = {
      conversationId: String(data.conversationId ?? ""),
      barId,
      barName,
      language: ctx.locale,
    };

    if (!session.conversationId) {
      throw new Error("waiter_conversation_missing");
    }

    await setState(ctx.supabase, ctx.profileId, {
      key: "bar_waiter_chat",
      data: session,
    });

    const welcomeMessage = typeof data.welcomeMessage === "string"
      ? data.welcomeMessage
      : t(ctx.locale, "bars.waiter.greeting");

    await sendText(
      ctx.from,
      `🤖 *${barName}*
\n${welcomeMessage}`,
    );

    // Offer quick actions after greeting
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "bars.waiter.quick_actions"),
      buildButtons(
        { id: IDS.WAITER_VIEW_PREFERENCES, title: t(ctx.locale, "bars.waiter.buttons.view_prefs") },
        { id: IDS.WAITER_SUGGESTIONS, title: t(ctx.locale, "bars.waiter.buttons.suggestions") },
      ),
    );

    // Auto-send personalized suggestions based on favorites + trending + new
    try {
      const res = await fetch(WAITER_AGENT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_INTERNAL_TOKEN },
        body: JSON.stringify({
          action: "assistant_suggestions",
          userId: ctx.profileId,
          conversationId: session.conversationId,
          language: session.language ?? ctx.locale,
          metadata: { venue: session.barId },
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = typeof data?.message === 'string' ? data.message : null;
        if (msg) await sendText(ctx.from, msg);
      }
    } catch (_) {}

    await logStructuredEvent("WAITER_CHAT_STARTED", {
      bar_id: barId,
      conversation_id: session.conversationId,
    });
    return true;
  } catch (error) {
    console.error("waiter.chat_start_error", error);
    await sendText(ctx.from, t(ctx.locale, "bars.waiter.error"));
    return true;
  }
}

export async function handleBarWaiterMessage(
  ctx: RouterContext,
  message: string,
  stateData?: Record<string, unknown>,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const session = stateData as WaiterChatSession | undefined;
  if (!session?.conversationId) {
    await sendText(
      ctx.from,
      t(ctx.locale, "bars.waiter.error"),
    );
    return true;
  }

  try {
    const response = await postWaiterAgent({
      action: "send_message",
      userId: ctx.profileId,
      conversationId: session.conversationId,
      language: session.language ?? ctx.locale,
      message,
    });

    let reply = "";
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/event-stream")) {
      reply = await readStreamedResponse(response);
    } else if (response.ok) {
      const data = await response.json();
      reply = typeof data.message === "string"
        ? data.message
        : String(data.content ?? "");
    }

    if (!reply.trim()) {
      reply = t(ctx.locale, "bars.waiter.processing");
    }

    await sendText(ctx.from, reply.trim());
    await logStructuredEvent("WAITER_MESSAGE_SENT", {
      bar_id: session.barId,
      conversation_id: session.conversationId,
    });
    return true;
  } catch (error) {
    console.error("waiter.chat_message_error", error);
    await sendText(ctx.from, t(ctx.locale, "bars.waiter.error"));
    return true;
  }
}

export async function handleBarWaiterAudio(
  ctx: RouterContext,
  msg: { audio?: { id?: string | null } | null },
  stateData?: Record<string, unknown>,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const session = stateData as WaiterChatSession | undefined;
  if (!session?.conversationId) {
    await sendText(ctx.from, t(ctx.locale, "bars.waiter.error"));
    return true;
  }

  const mediaId = msg.audio?.id || null;
  if (!mediaId) {
    await sendText(ctx.from, t(ctx.locale, "bars.waiter.processing"));
    return true;
  }

  try {
    const response = await postWaiterAgent({
      action: "send_audio",
      userId: ctx.profileId,
      conversationId: session.conversationId,
      language: session.language ?? ctx.locale,
      audio: {
        mediaId,
        phoneNumberId: WA_PHONE_ID,
        accessToken: WA_TOKEN,
      },
    });

    let reply = "";
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/event-stream")) {
      reply = await readStreamedResponse(response);
    } else if (response.ok) {
      const data = await response.json();
      reply = typeof data.message === "string"
        ? data.message
        : String(data.content ?? "");
    }

    if (!reply.trim()) {
      reply = t(ctx.locale, "bars.waiter.processing");
    }

    await sendText(ctx.from, reply.trim());
    await logStructuredEvent("WAITER_AUDIO_SENT", {
      bar_id: session.barId,
      conversation_id: session.conversationId,
    });
    return true;
  } catch (error) {
    console.error("waiter.chat_audio_error", error);
    await sendText(ctx.from, t(ctx.locale, "bars.waiter.error"));
    return true;
  }
}

export async function handleBarWaiterPreferences(
  ctx: RouterContext,
  stateData?: Record<string, unknown>,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const session = stateData as WaiterChatSession | undefined;
  if (!session?.conversationId) {
    await sendText(ctx.from, t(ctx.locale, "bars.waiter.error"));
    return true;
  }
  try {
    const res = await fetch(WAITER_AGENT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_INTERNAL_TOKEN },
      body: JSON.stringify({ action: "profile_summary", userId: ctx.profileId, conversationId: session.conversationId }),
    });
    const data = await res.json().catch(() => ({}));
    const summary = data?.profile?.summary || t(ctx.locale, "bars.waiter.no_prefs");
    await sendText(ctx.from, `🗂️ ${summary}`);
    return true;
  } catch (e) {
    console.error("waiter.view_prefs_error", e);
    await sendText(ctx.from, t(ctx.locale, "bars.waiter.no_prefs"));
    return true;
  }
}

export async function handleBarWaiterSuggestions(
  ctx: RouterContext,
  stateData?: Record<string, unknown>,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const session = stateData as WaiterChatSession | undefined;
  if (!session?.conversationId) {
    await sendText(ctx.from, t(ctx.locale, "bars.waiter.error"));
    return true;
  }
  try {
    const res = await fetch(WAITER_AGENT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_INTERNAL_TOKEN },
      body: JSON.stringify({
        action: "assistant_suggestions",
        userId: ctx.profileId,
        conversationId: session.conversationId,
        language: session.language ?? ctx.locale,
        metadata: { venue: session.barId },
      }),
    });
    const data = await res.json().catch(() => ({}));
    const msg = typeof data?.message === 'string' ? data.message : "Here are some ideas!";
    await sendText(ctx.from, msg);
    return true;
  } catch (e) {
    console.error("waiter.suggestions_error", e);
    await sendText(ctx.from, t(ctx.locale, "bars.waiter.processing"));
    return true;
  }
}

async function readStreamedResponse(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;
  }

  const lines = buffer.split("\n");
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      try {
        const payload = JSON.parse(line.slice(6));
        if (payload?.type === "done" && typeof payload.content === "string") {
          return payload.content;
        }
        if (payload?.content && typeof payload.content === "string") {
          return payload.content;
        }
      } catch (_) {
        continue;
      }
    }
  }
  return "";
}
