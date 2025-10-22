import { Injectable, Logger } from '@nestjs/common';
import type { MediaStream, MediaStreamTrack, RTCIceCandidateInit } from 'wrtc';
import { WaGraphService } from './wa-graph.service';
import { IceStoreService } from './ice-store.service';
import { CallRegistryService } from './call-registry.service';
import { WaPeer, createWaPeer } from './media/bridge-whatsapp-webrtc';
import { createRealtimePeer } from './media/openai-realtime-webrtc';
import type { WaCallEvent } from './common/dto/wa-calling.dto';
import { env } from '../../common/env';

@Injectable()
export class WaCallsService {
  private readonly logger = new Logger(WaCallsService.name);

  constructor(
    private readonly graph: WaGraphService,
    private readonly ice: IceStoreService,
    private readonly registry: CallRegistryService,
  ) {}

  verifyWebhook(query: Record<string, unknown>) {
    if (
      query['hub.mode'] === 'subscribe' &&
      query['hub.verify_token'] === env.waVerifyToken &&
      typeof query['hub.challenge'] === 'string'
    ) {
      return query['hub.challenge'];
    }
    return 'token mismatch';
  }

  async onEvents(body: WaCallEvent) {
    for (const entry of body.entry) {
      for (const change of entry.changes) {
        const call = change.value?.call;
        if (!call) {
          continue;
        }
        const callId = call.call_id;
        switch (call.status) {
          case 'offer':
            if (call.sdp) {
              await this.handleOffer(callId, call.sdp);
            }
            break;
          case 'connect':
            await this.handleConnect(callId);
            break;
          case 'update':
            await this.handleUpdate(callId, call.sdp, call.ice);
            break;
          case 'end':
            await this.handleEnd(callId);
            break;
          default:
            this.logger.warn(`Unhandled call status ${call.status}`);
        }
      }
    }
  }

  private async handleOffer(callId: string, whatsappOffer: string) {
    this.logger.log(`Received offer for ${callId}`);

    const pendingRealtimeTracks: Array<{ track: MediaStreamTrack; streams: MediaStream[] }> = [];
    let waPeer: WaPeer | null = null;

    const realtime = await createRealtimePeer({
      callId,
      onRemoteTrack: async (track, streams) => {
        const stream = streams?.[0];
        if (waPeer) {
          await waPeer.setOutboundTrack(track, stream);
        } else {
          pendingRealtimeTracks.push({ track, streams });
        }
      },
    });

    waPeer = await createWaPeer({
      callId,
      remoteOfferSdp: whatsappOffer,
      onRemoteTrack: async (track, streams) => {
        try {
          await realtime.addInboundTrack(track, streams?.[0]);
        } catch (error) {
          this.logger.warn(
            `Failed to forward inbound audio for ${callId}: ${this.describeError(error)}`,
          );
        }
      },
      onIceCandidate: async (candidate) => {
        try {
          await this.graph.sendIce(callId, candidate);
        } catch (error) {
          this.logger.warn(`Failed to send ICE candidate for ${callId}: ${this.describeError(error)}`);
        }
      },
      iceServers: this.turnServers(),
    });

    if (!waPeer) {
      throw new Error(`Failed to initialize WA peer for ${callId}`);
    }

    for (const pending of pendingRealtimeTracks) {
      const stream = pending.streams?.[0];
      await waPeer.setOutboundTrack(pending.track, stream);
    }

    const localSdp = waPeer.localDescription?.sdp;
    if (!localSdp) {
      throw new Error(`Missing local description for call ${callId}`);
    }
    await this.graph.acceptCall(callId, localSdp);
    this.registry.register(callId, { rt: realtime, wa: waPeer });
  }

  private async handleConnect(callId: string) {
    this.logger.log(`Connect received for ${callId}`);
  }

  private async handleUpdate(callId: string, sdp?: string, ice?: unknown) {
    const ref = this.registry.get(callId);
    if (!ref) {
      this.logger.warn(`No active call ref for ${callId}`);
      return;
    }

    if (ice && typeof ice === 'object') {
      const candidate = ice as RTCIceCandidateInit;
      await this.ice.pushIce(callId, candidate);
      try {
        await ref.wa.addRemoteIce(candidate);
      } catch (error) {
        this.logger.warn(`Failed to apply ICE candidate for ${callId}: ${this.describeError(error)}`);
      }
    }

    if (sdp) {
      try {
        await ref.wa.setRemoteDescription(sdp);
      } catch (error) {
        this.logger.warn(`Failed to apply remote SDP for ${callId}: ${this.describeError(error)}`);
      }
    }
  }

  private async handleEnd(callId: string) {
    this.logger.log(`Ending call ${callId}`);
    const ref = this.registry.get(callId);
    if (ref) {
      try {
        ref.wa.close();
      } catch (error) {
        this.logger.debug(`Error closing WA peer for ${callId}: ${this.describeError(error)}`);
      }
      try {
        ref.rt.close();
      } catch (error) {
        this.logger.debug(`Error closing realtime peer for ${callId}: ${this.describeError(error)}`);
      }
      this.registry.remove(callId);
    }
  }

  private turnServers() {
    if (!env.turnServers?.length) {
      return undefined;
    }
    return [
      {
        urls: env.turnServers,
        username: env.turnUsername ?? undefined,
        credential: env.turnPassword ?? undefined,
      },
    ];
  }

  private describeError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
