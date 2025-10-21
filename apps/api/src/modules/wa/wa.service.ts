import { Injectable } from '@nestjs/common';
import { fetch } from 'undici';
import { env } from '../../common/env';

@Injectable()
export class WAService {
  async sendText(msisdn: string, text: string) {
    if (!msisdn || !text) {
      return;
    }

    const response = await fetch(`https://graph.facebook.com/v20.0/${env.waPhoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.waToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: msisdn,
        type: 'text',
        text: { body: text },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('WhatsApp sendText failed', response.status, errText);
    }
  }
}
