import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RealtimeController } from '../modules/realtime/realtime.controller';
import { RealtimeService } from '../modules/realtime/realtime.service';
import { WhatsAppAgentController } from '../modules/wa/wa-agent.controller';
import { WhatsAppAgentService } from '../modules/wa/wa-agent.service';
import { SupabaseService } from '../modules/supabase/supabase.service';
import { env } from '../common/env';
import * as crypto from '../common/crypto';

describe('Critical route smoke tests', () => {
  let app: INestApplication;

  const realtimeMock: jest.Mocked<
    Pick<RealtimeService, 'verifySignature' | 'onIncomingWebhook' | 'handleSidebandEvent'>
  > = {
    verifySignature: jest.fn(),
    onIncomingWebhook: jest.fn(),
    handleSidebandEvent: jest.fn(),
  };

  const waAgentMock: jest.Mocked<
    Pick<WhatsAppAgentService, 'startConversation' | 'sendAssistantMessage' | 'logCustomerMessage'>
  > = {
    startConversation: jest.fn(),
    sendAssistantMessage: jest.fn(),
    logCustomerMessage: jest.fn(),
  };

  const supabaseMock: Partial<SupabaseService> = {
    getWaThreadById: jest.fn().mockResolvedValue({
      data: {
        id: 'thread-1',
        agent_profile: 'sales',
        customer_msisdn: '+250700000000',
      },
      error: null,
    }),
  };

  const sessionResponse = {
    config: { instructions: 'welcome to the bridge' },
    callId: 'call-123',
    agentProfile: 'sales' as const,
    agentDisplayName: 'Sales Closer',
  };

  beforeAll(async () => {
    env.bridgeSharedSecret = 'bridge-secret';

    const moduleRef = await Test.createTestingModule({
      controllers: [RealtimeController, WhatsAppAgentController],
      providers: [
        { provide: RealtimeService, useValue: realtimeMock },
        { provide: WhatsAppAgentService, useValue: waAgentMock },
        { provide: SupabaseService, useValue: supabaseMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    realtimeMock.verifySignature.mockReturnValue(true);
    realtimeMock.onIncomingWebhook.mockResolvedValue(sessionResponse);
    realtimeMock.handleSidebandEvent.mockResolvedValue(undefined);

    waAgentMock.startConversation.mockResolvedValue({ id: 'thread-1' } as any);
  });

  it('returns realtime session config from the webhook endpoint', async () => {
    const response = await request(app.getHttpServer())
      .post('/realtime/webhook')
      .set('x-openai-signature', 'valid-signature')
      .send({ foo: 'bar' })
      .expect(200);

    expect(realtimeMock.verifySignature).toHaveBeenCalledWith('valid-signature', undefined);
    expect(realtimeMock.onIncomingWebhook).toHaveBeenCalledWith(expect.objectContaining({ foo: 'bar' }));
    expect(response.body).toEqual(sessionResponse.config);
  });

  it('dispatches realtime sideband events when the JWT is valid', async () => {
    const verifyJwtSpy = jest.spyOn(crypto, 'verifyJwt').mockResolvedValue({ call_id: 'call-abc' } as any);

    const payload = { type: 'response.output_text.delta', data: { text: 'hello' } };

    await request(app.getHttpServer())
      .post('/realtime/events')
      .set('authorization', 'Bearer signed-token')
      .send(payload)
      .expect(200)
      .expect({ ok: true });

    expect(verifyJwtSpy).toHaveBeenCalledWith('signed-token', env.jwtSigningKey);
    expect(realtimeMock.handleSidebandEvent).toHaveBeenCalledWith('call-abc', payload);

    verifyJwtSpy.mockRestore();
  });

  it('creates a realtime session when the bridge secret matches', async () => {
    const response = await request(app.getHttpServer())
      .post('/realtime/session')
      .set('authorization', 'Bearer bridge-secret')
      .send({ session: true })
      .expect(201);

    expect(realtimeMock.onIncomingWebhook).toHaveBeenCalledWith(expect.objectContaining({ session: true }));
    expect(response.body).toEqual(sessionResponse);
  });

  it('starts a WhatsApp conversation through the public agent endpoint', async () => {
    waAgentMock.startConversation.mockResolvedValueOnce({ id: 'thread-99' } as any);

    const response = await request(app.getHttpServer())
      .post('/wa/agents/start')
      .send({ msisdn: '+250788000000' })
      .expect(201);

    expect(waAgentMock.startConversation).toHaveBeenCalledWith({
      msisdn: '+250788000000',
      profile: 'sales',
      callId: undefined,
      initialMessage: undefined,
      waConversationId: undefined,
      metadata: undefined,
    });

    expect(response.body).toEqual({
      threadId: 'thread-99',
      agentProfile: 'sales',
      agentDisplayName: 'Sales Closer',
      campaignTags: ['sales', 'conversion'],
    });
  });
});
