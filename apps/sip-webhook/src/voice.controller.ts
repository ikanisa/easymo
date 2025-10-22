import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { getSipWebhookControllerBasePath, getSipWebhookEndpointSegment } from '@easymo/commons';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

@Controller(getSipWebhookControllerBasePath('voice'))
export class VoiceController {
  @Post(getSipWebhookEndpointSegment('voice', 'incoming'))
  async inbound(@Body() body: any, @Res() res: Response) {
    const { From, To, CallSid } = body;
    const { data: agent } = await supabase.from('agents').select('*').limit(1).maybeSingle();

    await supabase.from('calls').insert({
      twilio_call_sid: CallSid,
      sip_from: From,
      sip_to: To,
      agent_id: agent?.id,
      status: 'in-progress'
    });

    const streamUrl = process.env.TWILIO_MEDIA_STREAM_WSS!;
    const twiml = [
      '<Response>',
      '  <Start>',
      `    <Stream url="${streamUrl}">`,
      '      <Parameter name="x-agent" value="default"/>',
      '    </Stream>',
      '  </Start>',
      '  <Pause length="3600"/>',
      '</Response>'
    ].join('\n');

    return res.type('text/xml').send(twiml);
  }

  @Post(getSipWebhookEndpointSegment('voice', 'status'))
  async status(@Body() body: any) {
    const statusMap: Record<string, string> = {
      initiated: 'queued',
      ringing: 'ringing',
      answered: 'in-progress',
      completed: 'completed',
      busy: 'busy',
      noanswer: 'no-answer',
      failed: 'failed'
    };
    const raw = (body.CallStatus || '').toLowerCase();
    const mapped = statusMap[raw];
    if (mapped) {
      await supabase
        .from('calls')
        .update({
          status: mapped,
          ended_at: ['completed', 'busy', 'no-answer', 'failed'].includes(mapped) ? new Date().toISOString() : null
        })
        .eq('twilio_call_sid', body.CallSid);
    }
    return { ok: true };
  }
}
