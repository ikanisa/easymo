import { logStructured } from './logger';

export type WhatsAppPayload = Record<string, unknown>;

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

export async function sendWhatsAppMessage(payload: WhatsAppPayload): Promise<Response | null> {
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

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    logStructured({
      event: 'wa_message_send_failed',
      status: 'error',
      message: `WhatsApp send failed (${response.status})`,
      details: { preview: safePreview(payload), error: errorText },
    });
    throw new Error(`whatsapp_send_failed_${response.status}`);
  }

  logStructured({
    event: 'wa_message_sent',
    status: 'ok',
    details: { preview: safePreview(payload) },
  });

  return response;
}
