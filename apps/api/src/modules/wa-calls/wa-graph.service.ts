import { Injectable, Logger } from '@nestjs/common';
import { fetch } from 'undici';
import type { RTCIceCandidateInit } from 'wrtc';
import { env } from '../../common/env';

const GRAPH_BASE_DEFAULT = 'https://graph.facebook.com/v21.0';

@Injectable()
export class WaGraphService {
  private readonly logger = new Logger(WaGraphService.name);

  private get baseUrl() {
    return env.waGraphApiBaseUrl ?? GRAPH_BASE_DEFAULT;
  }

  private get authHeaders() {
    return {
      Authorization: `Bearer ${env.waToken}`,
      'Content-Type': 'application/json',
    };
  }

  async acceptCall(callId: string, sdpAnswer: string) {
    const response = await fetch(`${this.baseUrl}/${env.waPhoneId}/calls/${callId}:accept`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify({ sdp: sdpAnswer }),
    });
    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Accept call failed (${response.status}) ${text}`);
      throw new Error(`WhatsApp accept failed: ${response.status}`);
    }
  }

  async sendIce(callId: string, candidate: RTCIceCandidateInit) {
    const response = await fetch(`${this.baseUrl}/${env.waPhoneId}/calls/${callId}:ice`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify({ candidate }),
    });
    if (!response.ok) {
      const text = await response.text();
      this.logger.warn(`Send ICE failed (${response.status}) ${text}`);
    }
  }

  // TODO: start outbound calls when the product surface allows it.
}
