export type WhatsAppMessagePayload = {
  to: string;
  type: string;
  [key: string]: unknown;
};

export type SendResult = {
  ok: boolean;
  status: number;
  error?: string;
};

export async function sendWhatsAppMessage(payload: WhatsAppMessagePayload): Promise<SendResult> {
  const endpoint = process.env.WHATSAPP_API_URL;
  const token = process.env.WHATSAPP_API_TOKEN;

  if (!endpoint) {
    console.warn('wa.send.endpoint_missing', { to: payload.to });
    return { ok: false, status: 503, error: 'endpoint_missing' };
  }

  const headers: HeadersInit = {
    'content-type': 'application/json',
  };
  if (token) {
    headers['authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('wa.send.failed', { status: response.status, body: text });
    return { ok: false, status: response.status, error: text || 'send_failed' };
  }

  return { ok: true, status: response.status };
}
