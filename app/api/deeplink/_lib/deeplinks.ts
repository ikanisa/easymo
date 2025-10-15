import { createHmac, randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getFeatureFlag } from '../../_lib/feature-flags';

export type DeeplinkFlow = 'insurance_attach' | 'basket_open' | 'generate_qr';

export interface SignedTokenPayload {
  flow: DeeplinkFlow;
  nonce: string;
  exp: string;
  msisdn?: string | null;
}

interface TokenHeader {
  alg: 'HS256';
  typ: 'DL1';
}

interface FlowConfig {
  path: string;
  featureFlag: string;
  nextStepHint: string;
}

const FLOW_CONFIG: Record<DeeplinkFlow, FlowConfig> = {
  insurance_attach: {
    path: '/flow/insurance-attach',
    featureFlag: 'deeplinks.insurance_attach.enabled',
    nextStepHint: 'insurance.attach_certificate',
  },
  basket_open: {
    path: '/flow/basket',
    featureFlag: 'deeplinks.basket_open.enabled',
    nextStepHint: 'basket.open',
  },
  generate_qr: {
    path: '/flow/qr',
    featureFlag: 'deeplinks.generate_qr.enabled',
    nextStepHint: 'qr.generate',
  },
};

export const DEFAULT_TTL_MINUTES = 20_160; // 14 days
export const MAX_TTL_MINUTES = 60 * 24 * 60; // ~60 days

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

function getSigningSecret(): string {
  const secret = process.env.DEEPLINK_SIGNING_SECRET;
  if (!secret) {
    throw new Error('DEEPLINK_SIGNING_SECRET is not configured');
  }
  return secret;
}

export function createSignedToken(payload: SignedTokenPayload, secret = getSigningSecret()) {
  const header: TokenHeader = { alg: 'HS256', typ: 'DL1' };
  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac('sha256', secret)
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest('base64url');
  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

export function verifySignedToken(token: string, secret = getSigningSecret()) {
  const segments = token.split('.');
  if (segments.length !== 3) {
    throw new Error('invalid_token_format');
  }
  const [headerEncoded, payloadEncoded, signature] = segments;
  const expectedSignature = createHmac('sha256', secret)
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest('base64url');
  if (expectedSignature !== signature) {
    throw new Error('invalid_token_signature');
  }
  const headerJson = Buffer.from(headerEncoded, 'base64url').toString('utf8');
  const payloadJson = Buffer.from(payloadEncoded, 'base64url').toString('utf8');
  const header = JSON.parse(headerJson) as TokenHeader;
  const payload = JSON.parse(payloadJson) as SignedTokenPayload;

  if (header.alg !== 'HS256' || header.typ !== 'DL1') {
    throw new Error('invalid_token_header');
  }

  return { header, payload };
}

export function computeExpiry(ttlMinutes: number) {
  const ttl = Math.min(Math.max(ttlMinutes, 1), MAX_TTL_MINUTES);
  return new Date(Date.now() + ttl * 60 * 1000);
}

export function createNonce() {
  return randomUUID();
}

export function getFlowConfig(flow: DeeplinkFlow): FlowConfig {
  return FLOW_CONFIG[flow];
}

export function buildDeepLinkUrl(flow: DeeplinkFlow, token: string) {
  const base = (process.env.DEEPLINK_BASE_URL ?? 'https://easymo.link').replace(/\/$/, '');
  const path = FLOW_CONFIG[flow]?.path ?? '/flow';
  return `${base}${path}?t=${encodeURIComponent(token)}`;
}

export async function ensureFlowEnabled(client: SupabaseClient, flow: DeeplinkFlow) {
  const config = FLOW_CONFIG[flow];
  if (!config) return false;
  const flag = await getFeatureFlag(client, config.featureFlag, true);
  if (typeof flag === 'boolean') {
    return flag;
  }
  if (flag && typeof flag === 'object' && 'enabled' in flag) {
    return Boolean(flag.enabled);
  }
  return Boolean(flag);
}

export async function recordDeeplinkEvent(
  client: SupabaseClient,
  tokenId: string,
  event: 'issued' | 'opened' | 'expired' | 'denied' | 'completed',
  meta?: Record<string, unknown>,
  actorMsisdn?: string | null,
) {
  const { error } = await client
    .from('deeplink_events')
    .insert({
      token_id: tokenId,
      event,
      actor_msisdn: actorMsisdn ?? null,
      meta: meta ?? null,
    });
  if (error) {
    console.error('deeplink.event.insert_failed', { event, tokenId, error: error.message });
  }
}

export function stripNonce(payload: Record<string, unknown> | null | undefined) {
  if (!payload) return {};
  const { nonce, ...rest } = payload;
  return rest;
}

export interface FlowBootstrapResult {
  flowState: Record<string, unknown>;
  firstPrompt: {
    type: 'text' | 'interactive';
    text: string;
    buttons?: { title: string; type: 'url' | 'reply'; payload?: string; url?: string }[];
    acceptMimeTypes?: string[];
  };
}

export function buildBootstrap(flow: DeeplinkFlow, payload: Record<string, unknown>, linkUrl: string): FlowBootstrapResult {
  const payloadRecord: Record<string, unknown> = payload ?? {};
  switch (flow) {
    case 'insurance_attach': {
      return {
        flowState: {
          flow: 'insurance',
          step: 'attach_certificate',
          ...payloadRecord,
        },
        firstPrompt: {
          type: 'text',
          text: 'Please upload a photo or PDF of your Insurance Certificate to complete verification.',
          acceptMimeTypes: ['image/*', 'application/pdf'],
        },
      } satisfies FlowBootstrapResult;
    }
    case 'basket_open': {
      const basketNameValue = payloadRecord['basket_name'];
      const basketName = typeof basketNameValue === 'string' ? basketNameValue : undefined;
      const promptText = basketName
        ? `Opened **${basketName}**. Choose an action:`
        : 'Basket opened. Choose an action:';
      return {
        flowState: {
          flow: 'basket',
          step: 'open',
          ...payloadRecord,
        },
        firstPrompt: {
          type: 'interactive',
          text: promptText,
          buttons: [
            { type: 'reply', title: 'View members', payload: 'basket_members' },
            { type: 'reply', title: 'Invite via Link', payload: 'basket_invite' },
            { type: 'reply', title: 'Contribute now', payload: 'basket_contribute' },
            { type: 'url', title: 'Open basket', url: linkUrl },
          ],
        },
      } satisfies FlowBootstrapResult;
    }
    case 'generate_qr': {
      const amountValue = payloadRecord['amount'];
      const amount = typeof amountValue === 'number' || typeof amountValue === 'string'
        ? ` (Amount: ${amountValue})`
        : '';
      return {
        flowState: {
          flow: 'qr',
          step: 'open',
          ...payloadRecord,
        },
        firstPrompt: {
          type: 'text',
          text: `MoMo QR Generator${amount}. Share details or update the amount then confirm to generate your QR code.`,
        },
      } satisfies FlowBootstrapResult;
    }
    default: {
      return {
        flowState: { flow, ...payloadRecord },
        firstPrompt: {
          type: 'text',
          text: 'Deep link loaded.',
        },
      } satisfies FlowBootstrapResult;
    }
  }
}
