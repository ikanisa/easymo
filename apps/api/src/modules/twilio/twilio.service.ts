import { Injectable } from '@nestjs/common';
import twilio from 'twilio';
import { env } from '../../common/env';

@Injectable()
export class TwilioService {
  private readonly client = twilio(env.twilioSid, env.twilioAuth);

  validateSignature(signature: string | undefined, requestUrl: string, body: Record<string, any>) {
    if (!signature) {
      return false;
    }
    return twilio.validateRequest(env.twilioAuth, signature, requestUrl, body);
  }

  async warmTransfer(callSid: string, queue: string) {
    return this.client.calls(callSid).update({
      method: 'POST',
      url: `${env.baseUrl}/twiml/warm-transfer?queue=${encodeURIComponent(queue)}`,
    });
  }
}
