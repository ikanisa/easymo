// Waiter AI Agent Integration for Bars & Restaurants
import type { RouterContext } from "../../types.ts";
import { t } from "../../i18n/translator.ts";
import { sendMessage } from "../../utils/reply.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import { setState, getState } from "../../state/store.ts";

interface WaiterConversation {
  conversationId: string;
  venueId: string;
  venueName: string;
  language: string;
  status: "active" | "completed";
}

/**
 * Start a conversation with AI Waiter for a specific venue
 */
export async function startWaiterChat(
  ctx: RouterContext,
  venueId: string,
  venueName: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  try {
    await logStructuredEvent("WAITER_CHAT_START", {
      userId: ctx.profileId,
      venueId,
      venueName,
      language: ctx.locale
    });

    // Call waiter-ai-agent edge function to start conversation
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/waiter-ai-agent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          action: "start_conversation",
          userId: ctx.profileId,
          language: ctx.locale,
          metadata: {
            venue: venueId,
            venueName,
            phoneNumber: ctx.phoneNumber
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Waiter AI failed: ${response.statusText}`);
    }

    const data = await response.json();

    // Store conversation state
    const conversationState: WaiterConversation = {
      conversationId: data.conversationId,
      venueId,
      venueName,
      language: ctx.locale,
      status: "active"
    };

    await setState(ctx.supabase, ctx.profileId, {
      key: "waiter_conversation",
      data: conversationState
    });

    // Send welcome message
    await sendMessage(ctx, {
      text: `🤖 *AI Waiter for ${venueName}*\n\n${data.welcomeMessage}\n\n_Just type your message to chat with the AI Waiter!_`
    });

    await logStructuredEvent("WAITER_CHAT_STARTED", {
      userId: ctx.profileId,
      conversationId: data.conversationId,
      venueId
    });

    return true;

  } catch (error) {
    await logStructuredEvent("WAITER_CHAT_ERROR", {
      error: error.message,
      userId: ctx.profileId,
      venueId
    });

    await sendMessage(ctx, {
      text: t(ctx.locale, "errors.generic")
    });

    return false;
  }
}

/**
 * Handle user message in ongoing waiter conversation
 */
export async function handleWaiterMessage(
  ctx: RouterContext,
  message: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  try {
    // Get conversation state
    const state = await getState<WaiterConversation>(
      ctx.supabase,
      ctx.profileId,
      "waiter_conversation"
    );

    if (!state?.data?.conversationId) {
      await sendMessage(ctx, {
        text: "❌ No active waiter conversation found. Please start a new chat from the bars menu."
      });
      return false;
    }

    await logStructuredEvent("WAITER_MESSAGE_SENT", {
      userId: ctx.profileId,
      conversationId: state.data.conversationId,
      messageLength: message.length
    });

    // Call waiter-ai-agent to process message
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/waiter-ai-agent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          action: "send_message",
          userId: ctx.profileId,
          conversationId: state.data.conversationId,
          message,
          language: state.data.language
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Waiter AI failed: ${response.statusText}`);
    }

    // Handle streaming response
    if (response.headers.get("content-type")?.includes("text/event-stream")) {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = JSON.parse(line.slice(6));
              if (data.type === "chunk") {
                fullResponse += data.content;
              } else if (data.type === "done") {
                fullResponse = data.content;
              }
            }
          }
        }
      }

      if (fullResponse) {
        await sendMessage(ctx, { text: fullResponse });
      }
    } else {
      const data = await response.json();
      await sendMessage(ctx, { text: data.message || "Response received" });
    }

    await logStructuredEvent("WAITER_MESSAGE_COMPLETE", {
      userId: ctx.profileId,
      conversationId: state.data.conversationId
    });

    return true;

  } catch (error) {
    await logStructuredEvent("WAITER_MESSAGE_ERROR", {
      error: error.message,
      userId: ctx.profileId
    });

    await sendMessage(ctx, {
      text: t(ctx.locale, "errors.generic")
    });

    return false;
  }
}

/**
 * End waiter conversation
 */
export async function endWaiterChat(
  ctx: RouterContext
): Promise<boolean> {
  if (!ctx.profileId) return false;

  try {
    const state = await getState<WaiterConversation>(
      ctx.supabase,
      ctx.profileId,
      "waiter_conversation"
    );

    if (state?.data?.conversationId) {
      await logStructuredEvent("WAITER_CHAT_END", {
        userId: ctx.profileId,
        conversationId: state.data.conversationId
      });
    }

    // Clear conversation state
    await setState(ctx.supabase, ctx.profileId, {
      key: "waiter_conversation",
      data: null
    });

    await sendMessage(ctx, {
      text: "👋 *Chat Ended*\n\nThank you for using AI Waiter! Your conversation has been saved."
    });

    return true;

  } catch (error) {
    await logStructuredEvent("WAITER_CHAT_END_ERROR", {
      error: error.message,
      userId: ctx.profileId
    });

    return false;
  }
}

/**
 * Check if user has active waiter conversation
 */
export async function hasActiveWaiterChat(
  ctx: RouterContext
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const state = await getState<WaiterConversation>(
    ctx.supabase,
    ctx.profileId,
    "waiter_conversation"
  );

  return state?.data?.status === "active";
}
