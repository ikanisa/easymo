import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { TwiMLController } from './twiml.controller';
import { env } from '../../common/env';

jest.mock('@easymo/commons', () => ({
  getApiControllerBasePath: (controller: string) => controller,
  getApiEndpointSegment: (controller: string, endpoint: string) => {
    if (controller === 'twiml' && endpoint === 'warmTransfer') {
      return 'warm-transfer';
    }
    return endpoint;
  },
}));

describe('TwiMLController (integration)', () => {
  let app: INestApplication;
  const originalEnv = { ...env };

  beforeAll(() => {
    env.twilioSipDomain = 'sip.example.test';
  });

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TwiMLController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(() => {
    Object.assign(env, originalEnv);
  });

  it('returns warm transfer TwiML when a queue is provided', async () => {
    const response = await request(app.getHttpServer())
      .get('/twiml/warm-transfer')
      .query({ queue: 'priority' })
      .expect(200);

    expect(response.headers['content-type']).toContain('text/xml');
    expect(response.text).toContain('<Sip>sip:priority@sip.example.test</Sip>');
  });

  it('falls back to the default queue when none is provided', async () => {
    const response = await request(app.getHttpServer())
      .get('/twiml/warm-transfer')
      .expect(200);

    expect(response.text).toContain('<Sip>sip:default@sip.example.test</Sip>');
  });
});
