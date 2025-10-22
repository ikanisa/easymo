import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { WaCallsController } from './calls.controller';
import { WaCallsService } from './calls.service';
import { WaWebhookGuard } from './common/guards/wa-webhook.guard';

describe('WaCallsController (integration)', () => {
  let app: INestApplication;
  let service: {
    verifyWebhook: jest.Mock<string, [Record<string, unknown>]>;
    onEvents: jest.Mock<Promise<void>, [any]>;
  };

  beforeEach(async () => {
    service = {
      verifyWebhook: jest.fn(),
      onEvents: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [WaCallsController],
      providers: [WaWebhookGuard, { provide: WaCallsService, useValue: service }],
    })
      .overrideGuard(WaWebhookGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns the webhook verification challenge', async () => {
    service.verifyWebhook.mockReturnValue('challenge-token');

    await request(app.getHttpServer())
      .get('/wa/webhook')
      .query({ 'hub.mode': 'subscribe', 'hub.challenge': 'challenge-token' })
      .expect(200, 'challenge-token');
  });

  it('acknowledges webhook events after processing them', async () => {
    service.onEvents.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .post('/wa/events')
      .send({ entry: [] })
      .expect(201, { ok: true });

    expect(service.onEvents).toHaveBeenCalledWith({ entry: [] });
  });
});
