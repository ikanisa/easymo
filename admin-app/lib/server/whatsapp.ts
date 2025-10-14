import { logStructured } from './logger';

export type WhatsAppPayload = Record<string, unknown>;

export type WhatsAppSendOptions = {
  timeoutMs?: number;
  maxRetries?: number;
};

const DEFAULT_TIMEOUT_MS = Number.parseInt(process.env.WHATSAPP_SEND_TIMEOUT_MS ?? '', 10);
const TIMEOUT_MS = Number.isNaN(DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS <= 0 ? 10_000 : DEFAULT_TIMEOUT_MS;
const DEFAULT_MAX_RETRIES = Number.parseInt(process.env.WHATSAPP_SEND_RETRIES ?? '', 10);
const MAX_RETRIES = Number.isNaN(DEFAULT_MAX_RETRIES) || DEFAULT_MAX_RETRIES < 0 ? 2 : DEFAULT_MAX_RETRIES;

export class WhatsAppSendError extends Error {
  constructor(message: string, readonly code: string, readonly status?: number) {
    super(message);
    this.name = 'WhatsAppSendError';
  }
}

function resolveEndpoint(): string | null {
  return (
    process.env.WHATSAPP_SEND_ENDPOINT ??
    process.env.NEXT_PUBLIC_WHATSAPP_SEND_ENDPOINT ??
    process.env.NEXT_PUBLIC_WHATSAPP_SEND_API ??
    null
  );
}

function safePreview(payload: WhatsAppPayload): string {
  try {
    return JSON.stringify(payload).slice(0, 512);
  } catch (_error) {
    return '[unserializable]';
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executeRequest(endpoint: string, payload: WhatsAppPayload, timeout: number) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function sendWhatsAppMessage(
  payload: WhatsAppPayload,
  options: WhatsAppSendOptions = {},
): Promise<Response | null> {
  const endpoint = resolveEndpoint();
  if (!endpoint) {
    logStructured({
      event: 'wa_message_skipped',
      status: 'degraded',
      message: 'WhatsApp send endpoint not configured',
      details: { preview: safePreview(payload) },
    });
    return null;
  }

  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? MAX_RETRIES;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await executeRequest(endpoint, payload, timeoutMs);
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logStructured({
          event: 'wa_message_send_failed',
          status: 'error',
          message: `WhatsApp send failed (${response.status})`,
          details: {
            preview: safePreview(payload),
            attempt,
            retries: maxRetries,
            error: errorText.slice(0, 256),
          },
        });
        throw new WhatsAppSendError('whatsapp_http_error', 'http_error', response.status);
      }

      logStructured({
        event: 'wa_message_sent',
        status: 'ok',
        details: { preview: safePreview(payload), retries: attempt },
      });

      return response;
    } catch (error) {
      lastError = error;

      const code = error instanceof WhatsAppSendError ? error.code : 'network_error';
      logStructured({
        event: 'wa_message_attempt_failed',
        status: 'error',
        message: 'WhatsApp send attempt failed',
        details: {
          preview: safePreview(payload),
          attempt,
          retries: maxRetries,
          code,
        },
      });

      if (attempt >= maxRetries) {
        break;
      }

      const backoffMs = Math.min(5_000, 500 * 2 ** attempt);
      await delay(backoffMs);
    }
  }

  if (lastError instanceof WhatsAppSendError) {
    throw lastError;
  }

  const errorMessage = lastError instanceof Error ? lastError.message : 'Unknown WhatsApp error';
  throw new WhatsAppSendError(errorMessage, 'network_error');
}
