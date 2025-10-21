import { Logger } from '@nestjs/common';

jest.mock('undici', () => ({
  fetch: jest.fn(),
}));

jest.mock('../../common/env', () => ({
  env: {
    waToken: 'token-123',
    waPhoneId: 'phone-456',
    waGraphApiBaseUrl: 'https://graph.test',
  },
}));

const { fetch } = jest.requireMock('undici') as { fetch: jest.Mock };
const { WaGraphService } = require('./wa-graph.service') as typeof import('./wa-graph.service');

describe('WaGraphService', () => {
  const service = new WaGraphService();
  const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

  beforeEach(() => {
    fetch.mockReset();
    loggerErrorSpy.mockClear();
    loggerWarnSpy.mockClear();
  });

  it('accepts calls with POST to Graph API', async () => {
    fetch.mockResolvedValue({ ok: true });

    await service.acceptCall('CALL123', 'SDP');

    expect(fetch).toHaveBeenCalledWith(
      'https://graph.test/phone-456/calls/CALL123:accept',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer token-123' }),
        body: JSON.stringify({ sdp: 'SDP' }),
      }),
    );
  });

  it('logs and throws when accept fails', async () => {
    fetch.mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('boom') });

    await expect(service.acceptCall('CALL123', 'SDP')).rejects.toThrow('WhatsApp accept failed: 500');
    expect(loggerErrorSpy).toHaveBeenCalledWith('Accept call failed (500) boom');
  });

  it('sends ICE candidates and logs warnings on failure', async () => {
    fetch.mockResolvedValueOnce({ ok: true });

    await service.sendIce('CALL123', { candidate: 'abc' });

    expect(fetch).toHaveBeenCalledWith(
      'https://graph.test/phone-456/calls/CALL123:ice',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ candidate: { candidate: 'abc' } }),
      }),
    );

    fetch.mockResolvedValueOnce({ ok: false, status: 400, text: () => Promise.resolve('bad request') });
    await service.sendIce('CALL123', { candidate: 'bad' });
    expect(loggerWarnSpy).toHaveBeenCalledWith('Send ICE failed (400) bad request');
  });
});
