import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { env } from '../../../../common/env';

@Injectable()
export class WaWebhookGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const request = ctx.switchToHttp().getRequest<Request & { rawBody?: Buffer }>();

    // Allow GET verification pings without signature
    if (request.method && request.method.toUpperCase() === 'GET') {
      return true;
    }

    const signature = (request.headers['x-hub-signature-256'] as string | undefined)?.trim();
    const rawBody = request.rawBody;

    if (!signature || !rawBody) {
      throw new UnauthorizedException('missing_signature');
    }

    const expected = `sha256=${createHmac('sha256', env.metaAppSecret).update(rawBody).digest('hex')}`;
    const provided = Buffer.from(signature);
    const comparison = Buffer.from(expected);

    if (provided.length !== comparison.length || !timingSafeEqual(provided, comparison)) {
      throw new UnauthorizedException('invalid_signature');
    }

    return true;
  }
}
