import { json } from 'body-parser';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response } from 'express';

@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  use(req: Request & { rawBody?: Buffer }, res: Response, next: (err?: any) => void) {
    const contentType = req.headers['content-type'] ?? '';
    if (typeof contentType === 'string' && contentType.includes('application/json')) {
      json({
        verify: (rawReq: Request & { rawBody?: Buffer }, _res, buf) => {
          rawReq.rawBody = Buffer.from(buf);
        },
      })(req, res, next as any);
      return;
    }
    next();
  }
}
