import { Body, Controller, Headers, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { RealtimeService } from './realtime.service';
import { MemoryController } from '../memory/memory.controller';
import { verifyJwt } from '../../common/crypto';
import { env } from '../../common/env';
import { getApiControllerBasePath, getApiEndpointSegment } from '@easymo/commons';

@Controller(getApiControllerBasePath('realtime'))
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  @Post(getApiEndpointSegment('realtime', 'webhook'))
  async webhook(
    @Headers('x-openai-signature') signature: string | undefined,
    @Req() request: Request & { rawBody?: Buffer },
    @Body() body: any,
    @Res() res: Response,
  ) {
    if (!this.realtime.verifySignature(signature, request.rawBody)) {
      return res.status(401).send('invalid signature');
    }
    const { config } = await this.realtime.onIncomingWebhook(body);
    return res.json(config);
  }

  @Post(getApiEndpointSegment('realtime', 'events'))
  async events(@Headers('authorization') auth: string | undefined, @Body() event: any, @Res() res: Response) {
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
    let payload: any;
    try {
      payload = await verifyJwt(token, env.jwtSigningKey);
    } catch (err) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const callId = typeof payload.call_id === 'string' ? payload.call_id : undefined;
    if (!callId) {
      return res.status(400).json({ error: 'missing call_id' });
    }
    await this.realtime.handleSidebandEvent(callId, event);
    return res.json({ ok: true });
  }

  @Post(getApiEndpointSegment('realtime', 'session'))
  async createSession(
    @Headers('authorization') auth: string | undefined,
    @Body() body: any,
  ) {
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
    if (!token || token !== env.bridgeSharedSecret) {
      throw new UnauthorizedException('unauthorized');
    }
    return this.realtime.onIncomingWebhook(body);
  }
}
