import {
  getAgentCoreControllerBasePath,
  getAgentCoreRouteSegment,
  getAgentCoreRouteServiceScopes,
} from "@easymo/commons";
import {
  Body,
  Controller,
  Delete,
  Get,
  MessageEvent,
  Param,
  Post,
  Sse,
  UseGuards,
} from "@nestjs/common";
import { fromEvent, map,Observable } from "rxjs";
import { z } from "zod";

import type { FarmerBrokerIntent } from "../../agents/farmer-broker.js";
import { ServiceScopes } from "../../common/decorators/service-scopes.decorator.js";
import { ServiceTokenGuard } from "../../common/guards/service-token.guard.js";
import { RealtimeFarmerService } from "./realtime-farmer.service.js";

const CreateSessionSchema = z.object({
  msisdn: z.string().min(8),
  locale: z.string().min(2).max(5),
  intent: z.enum(["farmer_supply", "buyer_demand"]),
  conversationId: z.string().uuid().optional(),
  farmContext: z.object({
    farmName: z.string().optional(),
    district: z.string().optional(),
    commodities: z.array(z.string()).optional(),
  }).optional(),
});

const SendAudioSchema = z.object({
  audioChunk: z.string(), // base64 encoded PCM16
});

const SendTextSchema = z.object({
  message: z.string().min(1),
});

const InjectContextSchema = z.object({
  farmName: z.string().optional(),
  district: z.string().optional(),
  commodities: z.array(z.string()).optional(),
  priceEstimate: z.number().optional(),
});

@Controller(getAgentCoreControllerBasePath("realtime"))
@UseGuards(ServiceTokenGuard)
export class RealtimeFarmerController {
  constructor(private readonly realtimeService: RealtimeFarmerService) {}

  @Post("farmer/session")
  @ServiceScopes(...getAgentCoreRouteServiceScopes("aiFarmerBrokerRun"))
  async createSession(@Body() body: unknown) {
    const payload = CreateSessionSchema.parse(body) as {
      msisdn: string;
      locale: string;
      intent: FarmerBrokerIntent;
      conversationId?: string;
      farmContext?: {
        farmName?: string;
        district?: string;
        commodities?: string[];
      };
    };

    const { sessionId } = await this.realtimeService.createSession(payload);

    return {
      success: true,
      sessionId,
      websocketUrl: `/realtime/farmer/ws/${sessionId}`,
      sseUrl: `/realtime/farmer/events/${sessionId}`,
    };
  }

  @Get("farmer/session/:sessionId")
  @ServiceScopes(...getAgentCoreRouteServiceScopes("aiFarmerBrokerRun"))
  async getSessionStatus(@Param("sessionId") sessionId: string) {
    const client = this.realtimeService.getSession(sessionId);
    if (!client) {
      return { exists: false };
    }

    return {
      exists: true,
      sessionId,
      connected: true,
    };
  }

  @Delete("farmer/session/:sessionId")
  @ServiceScopes(...getAgentCoreRouteServiceScopes("aiFarmerBrokerRun"))
  async closeSession(@Param("sessionId") sessionId: string) {
    await this.realtimeService.closeSession(sessionId);
    return { success: true };
  }

  @Post("farmer/session/:sessionId/audio")
  @ServiceScopes(...getAgentCoreRouteServiceScopes("aiFarmerBrokerRun"))
  async sendAudio(
    @Param("sessionId") sessionId: string,
    @Body() body: unknown,
  ) {
    const payload = SendAudioSchema.parse(body);
    
    // Decode base64 to Int16Array
    const audioBuffer = Buffer.from(payload.audioChunk, "base64");
    const int16Array = new Int16Array(
      audioBuffer.buffer,
      audioBuffer.byteOffset,
      audioBuffer.byteLength / 2,
    );

    await this.realtimeService.sendAudioChunk(sessionId, int16Array);
    return { success: true };
  }

  @Post("farmer/session/:sessionId/commit")
  @ServiceScopes(...getAgentCoreRouteServiceScopes("aiFarmerBrokerRun"))
  async commitAudio(@Param("sessionId") sessionId: string) {
    await this.realtimeService.commitAudio(sessionId);
    return { success: true };
  }

  @Post("farmer/session/:sessionId/text")
  @ServiceScopes(...getAgentCoreRouteServiceScopes("aiFarmerBrokerRun"))
  async sendText(
    @Param("sessionId") sessionId: string,
    @Body() body: unknown,
  ) {
    const payload = SendTextSchema.parse(body);
    await this.realtimeService.sendTextMessage(sessionId, payload.message);
    return { success: true };
  }

  @Post("farmer/session/:sessionId/context")
  @ServiceScopes(...getAgentCoreRouteServiceScopes("aiFarmerBrokerRun"))
  async injectContext(
    @Param("sessionId") sessionId: string,
    @Body() body: unknown,
  ) {
    const payload = InjectContextSchema.parse(body);
    await this.realtimeService.injectContext(sessionId, payload);
    return { success: true };
  }

  @Sse("farmer/events/:sessionId")
  async streamEvents(
    @Param("sessionId") sessionId: string,
  ): Promise<Observable<MessageEvent>> {
    const client = this.realtimeService.getSession(sessionId);
    if (!client) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Create observable from realtime events
    return new Observable<MessageEvent>((observer) => {
      // Audio output events
      this.realtimeService.onAudioOutput(sessionId, (audio) => {
        const base64Audio = Buffer.from(audio.buffer).toString("base64");
        observer.next({
          data: JSON.stringify({
            type: "audio.delta",
            audio: base64Audio,
            timestamp: Date.now(),
          }),
        });
      });

      // Transcript events
      this.realtimeService.onTranscript(sessionId, (transcript, role) => {
        observer.next({
          data: JSON.stringify({
            type: "transcript",
            role,
            text: transcript,
            timestamp: Date.now(),
          }),
        });
      });

      // Session updates
      this.realtimeService.onSessionUpdate(sessionId, (event) => {
        observer.next({
          data: JSON.stringify({
            type: "session.update",
            event,
            timestamp: Date.now(),
          }),
        });
      });

      // Cleanup on disconnect
      return () => {
        this.realtimeService.closeSession(sessionId);
      };
    });
  }

  @Get("farmer/sessions")
  @ServiceScopes(...getAgentCoreRouteServiceScopes("aiFarmerBrokerRun"))
  async listActiveSessions() {
    const sessionIds = this.realtimeService.getActiveSessions();
    return {
      count: sessionIds.length,
      sessions: sessionIds,
    };
  }

  @Delete("farmer/sessions")
  @ServiceScopes(...getAgentCoreRouteServiceScopes("aiFarmerBrokerRun"))
  async closeAllSessions() {
    await this.realtimeService.closeAllSessions();
    return { success: true };
  }
}
