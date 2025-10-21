import { createHmac, timingSafeEqual } from 'crypto';
import * as jose from 'jose';

export function verifyOpenAIWebhook(sigHeader: string | undefined, rawBody: Buffer, secret: string) {
  if (!sigHeader || !secret) {
    return false;
  }
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = Buffer.from(sigHeader, 'hex');
  const computed = Buffer.from(expected, 'hex');
  return provided.length === computed.length && timingSafeEqual(provided, computed);
}

export async function signJwt(payload: object, key: string, ttlSec = 300) {
  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(`${ttlSec}s`)
    .sign(Buffer.from(key));
}

export async function verifyJwt(token: string | undefined, key: string): Promise<jose.JWTPayload> {
  if (!token) {
    throw new Error('missing token');
  }
  const { payload } = await jose.jwtVerify(token, Buffer.from(key));
  return payload;
}
