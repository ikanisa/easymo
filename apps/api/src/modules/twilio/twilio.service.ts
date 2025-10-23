import { Injectable } from '@nestjs/common';
import { getApiEndpointPath } from '@easymo/commons';
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
    const warmTransferUrl = new URL(getApiEndpointPath('twiml', 'warmTransfer'), env.baseUrl);
    warmTransferUrl.searchParams.set('queue', queue);
    return this.client.calls(callSid).update({
      method: 'POST',
      url: warmTransferUrl.toString(),
    });
  }
}
