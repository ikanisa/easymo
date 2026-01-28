/**
 * WhatsApp Business API Sender
 * 
 * Provides utilities for sending messages via WhatsApp Business API
 * - Text messages
 * - Media messages (image, document)
 * - Template messages
 * - Interactive messages (buttons, lists)
 * - Automatic retry with exponential backoff
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

import { ExternalServiceError,WebhookError } from "./errors.ts";

interface SendMessageParams {
  to: string;
  type: "text" | "image" | "document" | "audio" | "video" | "template" | "interactive";
  content: any;
  contextMessageId?: string;
}

export class WhatsAppSender {
  private apiUrl: string;
  private accessToken: string;
  private phoneNumberId: string;

  constructor(config: {
    apiUrl?: string;
    accessToken: string;
    phoneNumberId: string;
  }) {
    this.apiUrl = config.apiUrl || "https://graph.facebook.com/v18.0";
    this.accessToken = config.accessToken;
    this.phoneNumberId = config.phoneNumberId;
  }

  async sendMessage(params: SendMessageParams): Promise<any> {
    const { to, type, content, contextMessageId } = params;

    const payload = this.buildPayload(to, type, content, contextMessageId);

    const response = await fetch(
      `${this.apiUrl}/${this.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new ExternalServiceError(
        "WhatsApp API",
        error.error?.message || `HTTP ${response.status}: Unknown error`
      );
    }

    const result = await response.json();
    return result;
  }

  private buildPayload(
    to: string,
    type: string,
    content: any,
    contextMessageId?: string
  ): any {
    const payload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to
    };

    if (contextMessageId) {
      payload.context = {
        message_id: contextMessageId
      };
    }

    switch (type) {
      case "text":
        payload.type = "text";
        payload.text = {
          preview_url: content.preview_url || false,
          body: content.body
        };
        break;

      case "image":
        payload.type = "image";
        payload.image = {
          link: content.url,
          caption: content.caption
        };
        break;

      case "document":
        payload.type = "document";
        payload.document = {
          link: content.url,
          caption: content.caption,
          filename: content.filename
        };
        break;

      case "audio":
        payload.type = "audio";
        payload.audio = {
          link: content.url
        };
        break;

      case "video":
        payload.type = "video";
        payload.video = {
          link: content.url,
          caption: content.caption
        };
        break;

      case "template":
        payload.type = "template";
        payload.template = {
          name: content.name,
          language: {
            code: content.language || "en"
          },
          components: content.components || []
        };
        break;

      case "interactive":
        payload.type = "interactive";
        payload.interactive = content;
        break;

      default:
        throw new WebhookError(
          `Unsupported message type: ${type}`,
          "INVALID_MESSAGE_TYPE",
          false,
          400
        );
    }

    return payload;
  }

  // ============================================
  // CONVENIENCE METHODS
  // ============================================

  async sendTextMessage(to: string, text: string, options?: {
    previewUrl?: boolean;
    contextMessageId?: string;
  }): Promise<any> {
    return this.sendMessage({
      to,
      type: "text",
      content: {
        body: text,
        preview_url: options?.previewUrl
      },
      contextMessageId: options?.contextMessageId
    });
  }

  async sendImageMessage(to: string, imageUrl: string, caption?: string): Promise<any> {
    return this.sendMessage({
      to,
      type: "image",
      content: {
        url: imageUrl,
        caption
      }
    });
  }

  async sendDocumentMessage(to: string, documentUrl: string, options?: {
    filename?: string;
    caption?: string;
  }): Promise<any> {
    return this.sendMessage({
      to,
      type: "document",
      content: {
        url: documentUrl,
        filename: options?.filename,
        caption: options?.caption
      }
    });
  }

  async sendTemplateMessage(to: string, template: {
    name: string;
    language?: string;
    components?: any[];
  }): Promise<any> {
    return this.sendMessage({
      to,
      type: "template",
      content: template
    });
  }

  async sendButtonMessage(to: string, body: string, buttons: Array<{
    id: string;
    title: string;
  }>): Promise<any> {
    return this.sendMessage({
      to,
      type: "interactive",
      content: {
        type: "button",
        body: { text: body },
        action: {
          buttons: buttons.map(btn => ({
            type: "reply",
            reply: {
              id: btn.id,
              title: btn.title
            }
          }))
        }
      }
    });
  }

  async sendListMessage(to: string, options: {
    body: string;
    buttonText: string;
    sections: Array<{
      title?: string;
      rows: Array<{
        id: string;
        title: string;
        description?: string;
      }>;
    }>;
  }): Promise<any> {
    return this.sendMessage({
      to,
      type: "interactive",
      content: {
        type: "list",
        body: { text: options.body },
        action: {
          button: options.buttonText,
          sections: options.sections
        }
      }
    });
  }

  async sendInteractiveMessage(to: string, interactive: any): Promise<any> {
    return this.sendMessage({
      to,
      type: "interactive",
      content: interactive
    });
  }

  async markAsRead(messageId: string): Promise<any> {
    const response = await fetch(
      `${this.apiUrl}/${this.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new ExternalServiceError(
        "WhatsApp API",
        `Failed to mark message as read: ${error.error?.message}`
      );
    }

    return response.json();
  }

  // ============================================
  // MEDIA MANAGEMENT
  // ============================================

  async uploadMedia(file: Blob, type: string): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    formData.append("messaging_product", "whatsapp");

    const response = await fetch(
      `${this.apiUrl}/${this.phoneNumberId}/media`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.accessToken}`
        },
        body: formData
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new ExternalServiceError(
        "WhatsApp API",
        `Failed to upload media: ${error.error?.message}`
      );
    }

    const result = await response.json();
    return result.id;
  }

  async getMediaUrl(mediaId: string): Promise<string> {
    const response = await fetch(
      `${this.apiUrl}/${mediaId}`,
      {
        headers: {
          "Authorization": `Bearer ${this.accessToken}`
        }
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new ExternalServiceError(
        "WhatsApp API",
        `Failed to get media URL: ${error.error?.message}`
      );
    }

    const result = await response.json();
    return result.url;
  }

  async downloadMedia(mediaUrl: string): Promise<Blob> {
    const response = await fetch(mediaUrl, {
      headers: {
        "Authorization": `Bearer ${this.accessToken}`
      }
    });

    if (!response.ok) {
      throw new ExternalServiceError(
        "WhatsApp API",
        `Failed to download media: HTTP ${response.status}`
      );
    }

    return response.blob();
  }
}

// ============================================
// RETRY WRAPPER
// ============================================

/**
 * Send message with automatic retry and exponential backoff
 */
export async function sendMessageWithRetry(
  sender: WhatsAppSender,
  params: SendMessageParams,
  maxRetries: number = 3
): Promise<any> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await sender.sendMessage(params);
    } catch (error) {
      lastError = error as Error;

      // Don't retry non-retryable errors
      if (error instanceof WebhookError && !error.retryable) {
        throw error;
      }

      // Last attempt - throw error
      if (attempt >= maxRetries) {
        break;
      }

      // Exponential backoff: 1s, 2s, 4s, 8s (max 10s)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new WebhookError(
    `Failed to send message after ${maxRetries} attempts: ${lastError?.message}`,
    "MAX_RETRIES_EXCEEDED",
    false,
    500
  );
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Create a WhatsAppSender instance from environment variables
 */
export function createWhatsAppSender(config?: {
  apiUrl?: string;
  accessToken?: string;
  phoneNumberId?: string;
}): WhatsAppSender {
  return new WhatsAppSender({
    apiUrl: config?.apiUrl || Deno.env.get("WHATSAPP_API_URL"),
    accessToken: config?.accessToken || Deno.env.get("WHATSAPP_ACCESS_TOKEN")!,
    phoneNumberId: config?.phoneNumberId || Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!
  });
}
