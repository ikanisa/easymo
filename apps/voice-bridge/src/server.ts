import 'dotenv/config';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import type { RawData } from 'ws';
import { createClient } from '@supabase/supabase-js';
import { getVoiceBridgeRoutePath } from '@easymo/commons';

const PORT = Number(process.env.VOICE_BRIDGE_PORT || 8080);
const REALTIME_URL = process.env.OPENAI_REALTIMEL_URL!;
const API_KEY = process.env.OPENAI_API_KEY!;
const VOICE = process.env.AGENT_DEFAULT_VOICE || 'verse';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const persona = `
SYSTEM ROLE:
You are "ICUPA/Lifuti Sales Caller", an autonomous, interruptible voice agent for Rwanda & Malta.
Primary languages: English and Kinyarwanda. Default to the caller/callee's language; if unsure, start in English and switch upon hint.
Be concise (≤3 short sentences per turn), friendly, and action-oriented.

BEHAVIOR:
- Always introduce yourself once, then ask a single focused question.
- Confirm critical facts back in one short line.
- If user shares name/phone/company/intent, say "noted" and continue.
- If the user is busy, offer a call-back window and verify WhatsApp number.
- Never over-talk: pause often; allow barge-in.

DATA CAPTURE (call the 'upsertLead' tool as soon as each datum appears):
- full name
- phone / WhatsApp
- company / role
- interest: {ICUPA dine-in, Lifuti rides, IKANISA social-finance}
- notes (free text)

QUALIFICATION:
- For ICUPA: Do you manage a bar/restaurant? Do you take orders via phone/WhatsApp? Peak hours? Pain points?
- For Lifuti (Rwanda): Are you a driver/rider? Current app? District? Typical hours?
- For IKANISA: Are you part of a group savings or fan club? Frequency and amounts?

CLOSE/CTA:
- If qualified: propose a 10-min WhatsApp setup call; confirm a slot today/tomorrow; send recap via WhatsApp.
- If unqualified: kindly end; ask for a referral.

COMPLIANCE:
- No promises of earnings. No payment processing on call.
- Respect do-not-call if requested; end politely.

STYLE:
- Rwanda: warm, respectful; sprinkle light Kinyarwanda courtesies ("Muraho", "Murakoze", "Ni byiza").
- Malta: clear, friendly; keep pace slow.

SAMPLE OPENERS:
[EN] "Hi, it’s the ICUPA/Lifuti team. Quick one — do you currently take orders on WhatsApp, or only at the counter?"
[RW] "Muraho neza! Ndi ku bwa ICUPA/Lifuti. Ndabaza gato — musanzwe mwakira commandes kuri WhatsApp, cyangwa ku meza gusa?"
`.trim();

type Pair = { twilio: WebSocket; openai: WebSocket };
const pairs = new Map<WebSocket, Pair>();

function connectOpenAI(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(REALTIME_URL, {
      headers: { Authorization: `Bearer ${API_KEY}`, 'OpenAI-Beta': 'realtime=v1' }
    });

    ws.once('open', () => {
      ws.send(JSON.stringify({
        type: 'session.update',
        session: {
          model: 'gpt-5-realtime-preview',
          voice: VOICE,
          input_audio_format: { type: 'g711_ulaw', sample_rate_hz: 8000 },
          input_audio_transcription: { enabled: true },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: Number(process.env.AGENT_VAD_PREFIX_MS || 80),
            silence_duration_ms: Number(process.env.AGENT_VAD_SILENCE_MS || 220)
          }
        }
      }));

      ws.send(JSON.stringify({
        type: 'response.create',
        response: {
          modalities: ['audio'],
          instructions: persona
        }
      }));

      resolve(ws);
    });

    ws.once('error', reject);
  });
}

const server = http.createServer();
const wss = new WebSocketServer({ server, path: getVoiceBridgeRoutePath('mediaStream') });

wss.on('connection', async (twilio: WebSocket) => {
  const openai = await connectOpenAI();
  pairs.set(twilio, { twilio, openai });

  let callSid: string | undefined;
  let callId: string | undefined;

  const logTranscript = async (role: 'user' | 'assistant', content: string | undefined) => {
    if (!callId || !content) return;
    await supabase.from('transcripts').insert({ call_id: callId, role, content });
  };

  const logEvent = async (kind: string, payload: unknown) => {
    if (!callId) return;
    await supabase.from('call_events').insert({ call_id: callId, kind, payload });
  };

  twilio.on('message', async (raw: RawData) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.event === 'start') {
        callSid = msg.start?.callSid;
        if (callSid) {
          const { data } = await supabase.from('calls').select('id').eq('twilio_call_sid', callSid).maybeSingle();
          callId = data?.id;
          await logEvent('call_start', { callSid });
        }
      }
      if (msg.event === 'media' && msg.media?.payload) {
        openai.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: msg.media.payload }));
      } else if (msg.event === 'stop') {
        openai.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
        openai.send(JSON.stringify({ type: 'response.create', response: { modalities: ['audio'] } }));
        await logEvent('stop', {});
      }
    } catch (err) {
      await logEvent('error', { stage: 'twilio_message', message: (err as Error).message });
    }
  });

  openai.on('message', async (raw: RawData) => {
    try {
      const evt = JSON.parse(raw.toString());

      if (evt.type === 'response.output_audio.delta' && evt.delta) {
        twilio.send(JSON.stringify({ event: 'media', media: { payload: evt.delta } }));
      }

      if (evt.type === 'response.output_text.delta' && typeof evt.delta === 'string') {
        await logTranscript('assistant', evt.delta);
      }

      if (
        (evt.type === 'input_audio_transcription.completed' || evt.type === 'input_transcription.completed') &&
        typeof evt.transcript === 'string'
      ) {
        await logTranscript('user', evt.transcript);
      }

      if (evt.type === 'response.function_call_arguments.delta') {
        await logEvent('tool_call_delta', evt);
      }

      if (evt.type === 'response.error') {
        await logEvent('error', evt);
      }
    } catch (err) {
      await logEvent('error', { stage: 'openai_message', message: (err as Error).message });
    }
  });

  const cleanup = async () => {
    try {
      await logEvent('call_end', { callSid });
      openai.close();
    } catch {
      // ignore cleanup errors
    }
    pairs.delete(twilio);
  };

  twilio.once('close', cleanup);
  twilio.once('error', cleanup);
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`voice-bridge listening on :${PORT}`);
});
