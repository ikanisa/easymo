import { z } from 'zod';
import { jsonError, jsonOk } from '../../_lib/http';
import { sendWhatsAppMessage } from './service';

const payloadSchema = z.object({
  to: z.string().min(5),
  type: z.string().min(1),
}).passthrough();

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch (error) {
    console.error('wa.send.invalid_json', error);
    return jsonError({ error: 'invalid_json' }, 400);
  }

  const parse = payloadSchema.safeParse(raw);
  if (!parse.success) {
    return jsonError({ error: 'invalid_payload', details: parse.error.flatten() }, 400);
  }

  const result = await sendWhatsAppMessage(parse.data);
  if (!result.ok) {
    return jsonError({ error: 'wa_send_failed', status: result.status, detail: result.error }, 502);
  }

  return jsonOk({ ok: true });
}
