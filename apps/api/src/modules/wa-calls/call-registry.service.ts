import { Injectable } from '@nestjs/common';
import type { RealtimePeer } from './media/openai-realtime-webrtc';
import type { WaPeer } from './media/bridge-whatsapp-webrtc';

export type CallRef = {
  rt: RealtimePeer;
  wa: WaPeer;
};

@Injectable()
export class CallRegistryService {
  private readonly memory = new Map<string, CallRef>();
  // NOTE: If this service ever runs on multiple nodes, mirror state via Redis.

  register(callId: string, ref: CallRef) {
    this.memory.set(callId, ref);
  }

  get(callId: string): CallRef | null {
    return this.memory.get(callId) ?? null;
  }

  remove(callId: string) {
    this.memory.delete(callId);
  }
}
