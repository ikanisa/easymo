import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { RealtimeController } from './realtime.controller';
import { RealtimeService } from './realtime.service';
import { env } from '../../common/env';
import * as crypto from '../../common/crypto';

jest.mock('@easymo/commons', () => ({
  getApiControllerBasePath: (controller: string) => controller,
  getApiEndpointSegment: (controller: string, endpoint: string) => {
    const segments: Record<string, Record<string, string>> = {
      realtime: {
        webhook: 'webhook',
        events: 'events',
        session: 'session',
      },
    };
    return segments[controller]?.[endpoint] ?? endpoint;
  },
}));

describe('RealtimeController (integration)', () => {
  let app: INestApplication;
  let service: {
    verifySignature: jest.Mock<boolean, [string | undefined, Buffer | undefined]>;
    onIncomingWebhook: jest.Mock<Promise<any>, [any]>;
    handleSidebandEvent: jest.Mock<Promise<void>, [string, any]>;
  };
  let verifyJwtSpy: jest.SpiedFunction<typeof crypto.verifyJwt>;
  const originalEnv = { ...env };

  beforeAll(() => {
    env.bridgeSharedSecret = 'test-bridge-secret';
    env.jwtSigningKey = 'test-jwt-secret';
  });

  beforeEach(async () => {
    service = {
      verifySignature: jest.fn(),
      onIncomingWebhook: jest.fn(),
      handleSidebandEvent: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [RealtimeController],
      providers: [{ provide: RealtimeService, useValue: service }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    verifyJwtSpy = jest.spyOn(crypto, 'verifyJwt');
  });

  afterEach(async () => {
    await app.close();
    verifyJwtSpy.mockRestore();
  });

  afterAll(() => {
    Object.assign(env, originalEnv);
  });

  it('rejects webhook requests with invalid signatures', async () => {
    service.verifySignature.mockReturnValue(false);

    await request(app.getHttpServer())
      .post('/realtime/webhook')
      .send({ hello: 'world' })
      .expect(401)
      .expect('invalid signature');
  });

  it('returns realtime session config when webhook signature is valid', async () => {
    const config = { foo: 'bar' };
    service.verifySignature.mockReturnValue(true);
    service.onIncomingWebhook.mockResolvedValue({ config });

    await request(app.getHttpServer())
      .post('/realtime/webhook')
      .send({ hello: 'world' })
      .expect(200, config);

    expect(service.onIncomingWebhook).toHaveBeenCalledWith({ hello: 'world' });
  });

  it('rejects realtime events when JWT verification fails', async () => {
    verifyJwtSpy.mockRejectedValueOnce(new Error('missing token'));

    await request(app.getHttpServer())
      .post('/realtime/events')
      .send({ type: 'test-event' })
      .expect(401)
      .expect({ error: 'unauthorized' });
  });

  it('logs realtime events when JWT verification succeeds', async () => {
    verifyJwtSpy.mockResolvedValueOnce({ call_id: 'call-123' } as any);
    service.handleSidebandEvent.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .post('/realtime/events')
      .set('authorization', 'Bearer valid')
      .send({ type: 'response.output_text.delta' })
      .expect(200)
      .expect({ ok: true });

    expect(service.handleSidebandEvent).toHaveBeenCalledWith('call-123', {
      type: 'response.output_text.delta',
    });
  });

  it('blocks realtime session creation without the shared secret', async () => {
    await request(app.getHttpServer()).post('/realtime/session').send({}).expect(401);
    expect(service.onIncomingWebhook).not.toHaveBeenCalled();
  });

  it('creates realtime session when the shared secret matches', async () => {
    const session = { config: { id: 'abc123' } };
    service.onIncomingWebhook.mockResolvedValue(session);

    await request(app.getHttpServer())
      .post('/realtime/session')
      .set('authorization', 'Bearer test-bridge-secret')
      .send({ country: 'RW' })
      .expect(201, session);

    expect(service.onIncomingWebhook).toHaveBeenCalledWith({ country: 'RW' });
  });
});
