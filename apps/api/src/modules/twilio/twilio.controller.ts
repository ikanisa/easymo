import { Body, Controller, Headers, Post, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { SupabaseService } from '../supabase/supabase.service';
import { TwilioService } from './twilio.service';
import { getApiControllerBasePath, getApiEndpointSegment } from '@easymo/commons';

@Controller(getApiControllerBasePath('twilio'))
export class TwilioController {
  constructor(
    private readonly db: SupabaseService,
    private readonly twilio: TwilioService,
  ) {}

  @Post(getApiEndpointSegment('twilio', 'status'))
  async status(
    @Headers('x-twilio-signature') signature: string | undefined,
    @Req() req: Request,
    @Body() body: any,
  ) {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto ?? req.protocol;
    const forwardedHost = req.headers['x-forwarded-host'];
    const hostHeader = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost ?? req.get('host') ?? '';
    const url = `${protocol}://${hostHeader}${req.originalUrl}`;

    if (!this.twilio.validateSignature(signature, url, body)) {
      throw new UnauthorizedException('invalid signature');
    }

    const callSid = body?.CallSid;
    if (callSid) {
      await this.db.updateCallBySid(callSid, {
        ended_at: new Date().toISOString(),
        duration_seconds: body?.CallDuration ? parseInt(body.CallDuration, 10) : null,
        outcome: body?.CallStatus,
      });
    }

    return { ok: true };
  }
}
