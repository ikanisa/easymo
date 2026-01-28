/**
 * WhatsApp Client Wrapper
 * Unified interface for sending WhatsApp messages
 */

import { TIMEOUTS } from "../config/constants.ts";
import { getEnv } from "../config/index.ts";
import { logStructuredEvent } from "../observability.ts";
import type { RouterContext } from "../types/context.ts";
import type { ButtonSpec, ListMessageOptions, OutgoingLocation, TemplateOptions } from "../types/messages.ts";

// ============================================================================
// TYPES
// ============================================================================

export type SendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

// ============================================================================
// WHATSAPP API CLIENT
// ============================================================================

class WhatsAppClient {
  private baseUrl: string;
  private token: string;
  private phoneId: string;

  constructor() {
    const env = getEnv();
    this.baseUrl = `https://graph.facebook.com/v18.0/${env.waPhoneId}`;
    this.token = env.waToken;
    this.phoneId = env.waPhoneId;
  }

  /**
   * Send API request
   */
  private async sendRequest(endpoint: string, body: unknown): Promise<SendResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.WA_API_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        logStructuredEvent("WA_API_ERROR", {
          status: response.status,
          error,
        }, "error");
        return {
          success: false,
          error: error?.error?.message || `HTTP ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        messageId: data?.messages?.[0]?.id,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      const errorMessage = error instanceof Error ? error.message : String(error);
      logStructuredEvent("WA_API_EXCEPTION", { error: errorMessage }, "error");
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send text message
   */
  async sendText(to: string, text: string): Promise<SendResult> {
    return this.sendRequest("/messages", {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body: text },
    });
  }

  /**
   * Send button message
   */
  async sendButtons(
    to: string,
    body: string,
    buttons: ButtonSpec[],
    options: { header?: string; footer?: string } = {}
  ): Promise<SendResult> {
    const interactive: Record<string, unknown> = {
      type: "button",
      body: { text: body },
      action: {
        buttons: buttons.map((btn) => ({
          type: "reply",
          reply: { id: btn.id, title: btn.title },
        })),
      },
    };

    if (options.header) {
      interactive.header = { type: "text", text: options.header };
    }
    if (options.footer) {
      interactive.footer = { text: options.footer };
    }

    return this.sendRequest("/messages", {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive,
    });
  }

  /**
   * Send list message
   */
  async sendList(to: string, options: ListMessageOptions): Promise<SendResult> {
    return this.sendRequest("/messages", {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        header: options.title ? { type: "text", text: options.title } : undefined,
        body: { text: options.body },
        action: {
          button: options.buttonText,
          sections: [
            {
              title: options.sectionTitle || "Options",
              rows: options.rows.map((row) => ({
                id: row.id,
                title: row.title,
                description: row.description,
              })),
            },
          ],
        },
      },
    });
  }

  /**
   * Send location message
   */
  async sendLocation(to: string, location: OutgoingLocation): Promise<SendResult> {
    return this.sendRequest("/messages", {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "location",
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        name: location.name,
        address: location.address,
      },
    });
  }

  /**
   * Send template message
   */
  async sendTemplate(to: string, template: TemplateOptions): Promise<SendResult> {
    const components: Array<Record<string, unknown>> = [];
    
    if (template.bodyParameters?.length) {
      components.push({
        type: "body",
        parameters: template.bodyParameters,
      });
    }

    return this.sendRequest("/messages", {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: template.name,
        language: { code: template.language },
        components: components.length > 0 ? components : undefined,
      },
    });
  }

  /**
   * Get media URL
   */
  async getMediaUrl(mediaId: string): Promise<string | null> {
    try {
      const response = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data.url || null;
    } catch {
      return null;
    }
  }

  /**
   * Download media
   */
  async downloadMedia(mediaUrl: string): Promise<{ data: Uint8Array; mime: string } | null> {
    try {
      const response = await fetch(mediaUrl, {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      if (!response.ok) return null;

      const mime = response.headers.get("content-type") || "application/octet-stream";
      const data = new Uint8Array(await response.arrayBuffer());
      
      return { data, mime };
    } catch {
      return null;
    }
  }
}

// Singleton instance
let clientInstance: WhatsAppClient | null = null;

/**
 * Get WhatsApp client instance
 */
export function getWhatsAppClient(): WhatsAppClient {
  if (!clientInstance) {
    clientInstance = new WhatsAppClient();
  }
  return clientInstance;
}

// ============================================================================
// CONVENIENCE FUNCTIONS WITH CONTEXT
// ============================================================================

/**
 * Send text message using context
 */
export async function sendText(ctx: RouterContext, text: string): Promise<SendResult> {
  const result = await getWhatsAppClient().sendText(ctx.from, text);
  if (!result.success) {
    logStructuredEvent("SEND_TEXT_FAILED", {
      requestId: ctx.requestId,
      error: result.error,
    }, "warn");
  }
  return result;
}

/**
 * Send buttons message using context
 */
export async function sendButtons(
  ctx: RouterContext,
  body: string,
  buttons: ButtonSpec[],
  options?: { header?: string; footer?: string }
): Promise<SendResult> {
  const result = await getWhatsAppClient().sendButtons(ctx.from, body, buttons, options);
  if (!result.success) {
    logStructuredEvent("SEND_BUTTONS_FAILED", {
      requestId: ctx.requestId,
      error: result.error,
    }, "warn");
  }
  return result;
}

/**
 * Send list message using context
 */
export async function sendList(
  ctx: RouterContext,
  options: ListMessageOptions
): Promise<SendResult> {
  const result = await getWhatsAppClient().sendList(ctx.from, options);
  if (!result.success) {
    logStructuredEvent("SEND_LIST_FAILED", {
      requestId: ctx.requestId,
      error: result.error,
    }, "warn");
  }
  return result;
}

/**
 * Send location message using context
 */
export async function sendLocation(
  ctx: RouterContext,
  location: OutgoingLocation
): Promise<SendResult> {
  const result = await getWhatsAppClient().sendLocation(ctx.from, location);
  if (!result.success) {
    logStructuredEvent("SEND_LOCATION_FAILED", {
      requestId: ctx.requestId,
      error: result.error,
    }, "warn");
  }
  return result;
}

export { WhatsAppClient };
