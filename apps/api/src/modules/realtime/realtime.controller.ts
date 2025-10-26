import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { RealtimeService } from './realtime.service';
import { verifyJwt } from '../../common/crypto';
import { env } from '../../common/env';
import { getApiControllerBasePath, getApiEndpointSegment } from '@easymo/commons';
import { RealtimeEventDto } from './dto/realtime-event.dto';
import { RealtimeSessionDto } from './dto/realtime-session.dto';

@Controller(getApiControllerBasePath('realtime'))
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  @Post(getApiEndpointSegment('realtime', 'webhook'))
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Headers('x-openai-signature') signature: string | undefined,
    @Req() request: Request & { rawBody?: Buffer },
    @Body() body: RealtimeSessionDto,
    @Res() res: Response,
  ) {
    if (!this.realtime.verifySignature(signature, request.rawBody)) {
      return res.status(401).send('invalid signature');
    }
    const normalized = body?.raw ?? body;
    const { config } = await this.realtime.onIncomingWebhook(normalized);
    return res.json(config);
  }

  @Post(getApiEndpointSegment('realtime', 'events'))
  @HttpCode(HttpStatus.OK)
  async events(
    @Headers('authorization') auth: string | undefined,
    @Body() event: RealtimeEventDto,
    @Res() res: Response,
  ) {
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
    const normalized = event?.raw ?? event;
    await this.realtime.handleSidebandEvent(callId, normalized);
    return res.json({ ok: true });
  }

  @Post(getApiEndpointSegment('realtime', 'session'))
  async createSession(
    @Headers('authorization') auth: string | undefined,
    @Body() body: RealtimeSessionDto,
  ) {
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
    if (!token || token !== env.bridgeSharedSecret) {
      throw new UnauthorizedException('unauthorized');
    }
    const normalized = body?.raw ?? body;
    return this.realtime.onIncomingWebhook(normalized);
  }
}
