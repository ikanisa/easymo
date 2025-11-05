import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildBootstrap,
  buildDeepLinkUrl,
  createNonce,
  createSignedToken,
  DEFAULT_TTL_MINUTES,
  DeeplinkFlow,
  stripNonce,
  verifySignedToken,
} from '../../app/api/deeplink/_lib/deeplinks';

const SECRET = 'test-secret-key';

describe('deeplink signing', () => {
  beforeEach(() => {
    process.env.DEEPLINK_SIGNING_SECRET = SECRET;
    process.env.DEEPLINK_BASE_URL = 'https://easymo.link';
  });

  afterEach(() => {
    delete process.env.DEEPLINK_SIGNING_SECRET;
    delete process.env.DEEPLINK_BASE_URL;
  });

  it('creates and verifies a signed token', () => {
    const nonce = createNonce();
    const expiresAt = new Date(Date.now() + DEFAULT_TTL_MINUTES * 60 * 1000);
    const token = createSignedToken({
      flow: 'basket_open',
      nonce,
      exp: expiresAt.toISOString(),
      msisdn: '+250700000000',
    });

    const decoded = verifySignedToken(token);
    expect(decoded.payload.flow).toBe('basket_open');
    expect(decoded.payload.nonce).toBe(nonce);
    expect(decoded.payload.msisdn).toBe('+250700000000');
  });

  it('throws when signature is altered', () => {
    const token = createSignedToken({
      flow: 'generate_qr',
      nonce: createNonce(),
      exp: new Date(Date.now() + 1000).toISOString(),
    });

    const tampered = token.replace(/.$/, (match) => (match === 'A' ? 'B' : 'A'));
    expect(() => verifySignedToken(tampered)).toThrow();
  });

  it('builds deep link urls per flow', () => {
    const token = 'abc';
    const flows: DeeplinkFlow[] = ['insurance_attach', 'basket_open', 'generate_qr'];
    const urls = flows.map((flow) => buildDeepLinkUrl(flow, token));
    expect(urls).toEqual([
      'https://easymo.link/flow/insurance-attach?t=abc',
      'https://easymo.link/flow/basket?t=abc',
      'https://easymo.link/flow/qr?t=abc',
    ]);
  });

  it('falls back to default deeplink host when env is unset', () => {
    delete process.env.DEEPLINK_BASE_URL;
    const url = buildDeepLinkUrl('basket_open', 'xyz');
    expect(url).toBe('https://easymo.link/flow/basket?t=xyz');
  });

  it('strips nonce from payload objects', () => {
    const payload = { nonce: 'abc', basket_id: 'bkt_123' };
    expect(stripNonce(payload)).toEqual({ basket_id: 'bkt_123' });
    expect(stripNonce(null)).toEqual({});
  });

  it('builds bootstrap prompts per flow', () => {
    const basketBootstrap = buildBootstrap(
      'basket_open',
      { basket_id: 'bkt_123', basket_name: 'Ibimina' },
      'https://easymo.link/flow/basket?t=test',
    );
    expect(basketBootstrap.flowState).toMatchObject({ flow: 'basket', basket_id: 'bkt_123' });
    expect(basketBootstrap.firstPrompt.type).toBe('interactive');

    const insuranceBootstrap = buildBootstrap(
      'insurance_attach',
      { request_id: 'rq_1' },
      'https://easymo.link/flow/insurance-attach?t=test',
    );
    expect(insuranceBootstrap.flowState).toMatchObject({ step: 'attach_certificate' });
    expect(insuranceBootstrap.firstPrompt.acceptMimeTypes).toContain('image/*');

    const qrBootstrap = buildBootstrap(
      'generate_qr',
      { amount: 2000, currency: 'RWF', note: 'Moto fare Kimironko → CBD' },
      'https://easymo.link/flow/qr?t=test',
    );
    expect(qrBootstrap.flowState).toMatchObject({ flow: 'qr', amount: 2000, currency: 'RWF' });
    expect(qrBootstrap.firstPrompt.text).toContain('MoMo QR Generator.');
    expect(qrBootstrap.firstPrompt.text).toContain('Amount: 2000 RWF');
    expect(qrBootstrap.firstPrompt.text).toContain('Note: Moto fare Kimironko → CBD');
    expect(qrBootstrap.firstPrompt.text).toContain('Confirm to generate your QR code.');
  });

  it('creates nonce values with adequate entropy', () => {
    const set = new Set<string>();
    for (let i = 0; i < 5; i += 1) {
      const nonce = createNonce();
      expect(nonce).toMatch(/^[a-zA-Z0-9_-]{21,}$/);
      set.add(nonce);
    }
    expect(set.size).toBeGreaterThanOrEqual(5);
  });

  it('strips secret-dependent fields before verifying payloads', () => {
    const expiresAt = new Date(Date.now() + DEFAULT_TTL_MINUTES * 60 * 1000).toISOString();
    const token = createSignedToken({ flow: 'insurance_attach', nonce: 'nonce', exp: expiresAt, meta: 'data' });
    const verified = verifySignedToken(token);
    expect(verified.payload).not.toHaveProperty('secret');
    expect(verified.payload.flow).toBe('insurance_attach');
  });
});
