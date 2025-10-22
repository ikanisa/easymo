import { Body, Controller, Post } from '@nestjs/common';
import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';
import {
  getSipWebhookControllerBasePath,
  getSipWebhookEndpointPath,
  getSipWebhookEndpointSegment,
} from '@easymo/commons';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);

@Controller(getSipWebhookControllerBasePath('dial'))
export class DialController {
  @Post(getSipWebhookEndpointSegment('dial', 'outbound'))
  async outbound(@Body() body: { to?: string; agent_id?: string }) {
    const to = body?.to ?? process.env.OUTBOUND_SIP_URI!;
    const agentId =
      body?.agent_id ??
      (await supabase.from('agents').select('id').limit(1).maybeSingle()).data?.id ??
      null;

    const { data: call } = await supabase
      .from('calls')
      .insert({
        sip_from: process.env.OUTBOUND_CALLER_ID,
        sip_to: to,
        agent_id: agentId,
        status: 'queued'
      })
      .select('*')
      .single();

    const twiml = [
      '<Response>',
      '  <Start>',
      `    <Stream url="${process.env.TWILIO_MEDIA_STREAM_WSS}">`,
      '      <Parameter name="x-agent" value="default"/>',
      '    </Stream>',
      '  </Start>',
      '  <Pause length="3600"/>',
      '</Response>'
    ].join('');

    const statusCallbackBase = process.env.PUBLIC_BASE_URL!.replace(/\/+$/, '');
    const statusCallbackPath = getSipWebhookEndpointPath('voice', 'status');

    const result = await client.calls.create({
      to,
      from: process.env.OUTBOUND_CALLER_ID!,
      twiml,
      statusCallback: `${statusCallbackBase}${statusCallbackPath}`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST'
    });

    if (call?.id) {
      await supabase.from('calls').update({ twilio_call_sid: result.sid }).eq('id', call.id);
    }

    return { ok: true, call_id: call?.id, sid: result.sid };
  }
}
