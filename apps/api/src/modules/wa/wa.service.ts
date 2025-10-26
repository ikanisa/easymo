import { Injectable } from '@nestjs/common';
import { fetch } from 'undici';
import { env } from '../../common/env';

@Injectable()
export class WAService {
  private readonly endpoint: string;
  private readonly authHeader: string;

  constructor() {
    if (!env.waPhoneId || !env.waToken) {
      throw new Error('WABA_PHONE_NUMBER_ID and WABA_ACCESS_TOKEN must be configured for WhatsApp messaging.');
    }

    const base = (env.waGraphApiBaseUrl ?? 'https://graph.facebook.com').replace(/\/$/, '');
    this.endpoint = `${base}/${env.waPhoneId}/messages`;
    this.authHeader = `Bearer ${env.waToken}`;
  }

  async sendText(msisdn: string, text: string) {
    if (!msisdn || !text) {
      return;
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
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
