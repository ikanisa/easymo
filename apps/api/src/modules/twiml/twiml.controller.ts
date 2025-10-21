import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { env } from '../../common/env';

@Controller('/twiml')
export class TwiMLController {
  @Get('warm-transfer')
  warm(@Query('queue') queue: string, @Res() res: Response) {
    const safeQueue = queue ?? 'default';
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Sip>sip:${safeQueue}@${env.twilioSipDomain}</Sip>
  </Dial>
</Response>`;
    res.set('Content-Type', 'text/xml').send(xml);
  }
}
