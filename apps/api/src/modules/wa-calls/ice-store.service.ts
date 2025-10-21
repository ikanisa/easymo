import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import type { RTCIceCandidateInit } from 'wrtc';
import { env } from '../../common/env';

@Injectable()
export class IceStoreService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;

  onModuleInit() {
    if (!env.redisUrl) {
      return;
    }
    this.client = new Redis(env.redisUrl);
  }

  onModuleDestroy() {
    this.client?.disconnect();
    this.client = null;
  }

  async pushIce(callId: string, candidate: RTCIceCandidateInit) {
    if (!this.client) {
      return;
    }
    const key = this.key(callId);
    await this.client.lpush(key, JSON.stringify(candidate));
    await this.client.expire(key, 600);
  }

  async popIce(callId: string): Promise<RTCIceCandidateInit | null> {
    if (!this.client) {
      return null;
    }
    const serialized = await this.client.rpop(this.key(callId));
    return serialized ? (JSON.parse(serialized) as RTCIceCandidateInit) : null;
  }

  private key(callId: string) {
    return `ice:${callId}`;
  }
}
