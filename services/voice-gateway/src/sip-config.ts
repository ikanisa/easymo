/**
 * SIP Trunk Configuration Module
 * 
 * Configures SIP trunking for:
 * 1. OpenAI Native SIP - Direct SIP connection to OpenAI Realtime
 * 2. MTN Rwanda SIP - Mobile telecom SIP trunk
 * 
 * These allow phone calls to connect to the AI voice gateway.
 */

import { config } from './config';
import { logger } from './logger';

export type SIPProvider = 'openai' | 'mtn' | 'generic';

export interface SIPTrunkConfig {
  /** SIP trunk provider */
  provider: SIPProvider;
  /** SIP server endpoint (e.g., sip.openai.com:5060) */
  endpoint: string;
  /** SIP authentication username */
  username: string;
  /** SIP authentication password */
  password: string;
  /** SIP realm for authentication */
  realm?: string;
  /** Transport protocol */
  transport: 'udp' | 'tcp' | 'tls';
  /** Codecs supported */
  codecs: string[];
  /** DID numbers routed to this trunk */
  didNumbers: string[];
  /** Whether trunk is enabled */
  enabled: boolean;
}

export interface IncomingCallInfo {
  /** Unique call ID from SIP provider */
  callId: string;
  /** Caller phone number (E.164 format) */
  from: string;
  /** Called DID number (E.164 format) */
  to: string;
  /** SIP provider that received the call */
  provider: SIPProvider;
  /** SIP headers */
  headers?: Record<string, string>;
  /** Call timestamp */
  timestamp: Date;
}

export interface CallRouteResult {
  /** Whether to accept the call */
  accept: boolean;
  /** Agent ID to handle the call */
  agentId?: string;
  /** Custom system prompt override */
  systemPrompt?: string;
  /** Voice style to use */
  voiceStyle?: string;
  /** Language code */
  language?: string;
  /** Reject reason if not accepted */
  rejectReason?: string;
  /** Metadata to pass to session */
  metadata?: Record<string, unknown>;
}

/**
 * Get SIP trunk configuration for a provider
 */
export function getSIPTrunkConfig(provider: SIPProvider): SIPTrunkConfig | null {
  switch (provider) {
    case 'openai':
      return getOpenAISIPConfig();
    case 'mtn':
      return getMTNSIPConfig();
    default:
      return null;
  }
}

/**
 * OpenAI SIP Trunk Configuration
 * 
 * OpenAI provides native SIP trunking for Realtime API.
 * This allows direct phone calls to connect to AI agents.
 * 
 * Setup requirements:
 * 1. Configure SIP trunk in OpenAI Dashboard
 * 2. Point your DID provider to OpenAI SIP endpoint
 * 3. Set environment variables for credentials
 */
function getOpenAISIPConfig(): SIPTrunkConfig {
  const enabled = Boolean(config.OPENAI_SIP_ENDPOINT);
  
  return {
    provider: 'openai',
    endpoint: config.OPENAI_SIP_ENDPOINT || 'sip.openai.com:5061',
    username: config.OPENAI_SIP_USERNAME || '',
    password: config.OPENAI_SIP_PASSWORD || '',
    realm: 'openai.com',
    transport: 'tls',
    codecs: ['PCMU', 'PCMA', 'G722', 'opus'],
    didNumbers: config.VOICE_DID_NUMBERS.filter(n => n.startsWith('openai:')).map(n => n.replace('openai:', '')),
    enabled,
  };
}

/**
 * MTN Rwanda SIP Trunk Configuration
 * 
 * MTN provides SIP trunking for mobile calls in Rwanda.
 * This allows local phone numbers to connect to the AI system.
 * 
 * Setup requirements:
 * 1. Contract with MTN Rwanda for SIP trunk service
 * 2. Configure firewall to allow MTN SIP traffic
 * 3. Set environment variables for MTN credentials
 */
function getMTNSIPConfig(): SIPTrunkConfig {
  const enabled = Boolean(config.MTN_SIP_ENDPOINT);
  
  return {
    provider: 'mtn',
    endpoint: config.MTN_SIP_ENDPOINT || 'sip.mtn.rw:5060',
    username: config.MTN_SIP_USERNAME || '',
    password: config.MTN_SIP_PASSWORD || '',
    realm: config.MTN_SIP_REALM || 'mtn.rw',
    transport: 'tls',
    codecs: ['PCMU', 'PCMA', 'G729'],
    didNumbers: config.VOICE_DID_NUMBERS.filter(n => n.startsWith('mtn:')).map(n => n.replace('mtn:', '')),
    enabled,
  };
}

/**
 * Get all enabled SIP trunk configurations
 */
export function getAllEnabledTrunks(): SIPTrunkConfig[] {
  const trunks: SIPTrunkConfig[] = [];
  
  const openai = getOpenAISIPConfig();
  if (openai.enabled) trunks.push(openai);
  
  const mtn = getMTNSIPConfig();
  if (mtn.enabled) trunks.push(mtn);
  
  return trunks;
}

/**
 * Route an incoming call to the appropriate agent
 * 
 * This is the main routing logic for incoming calls.
 * It determines which agent should handle the call based on:
 * 1. Called DID number
 * 2. Caller information
 * 3. Time of day
 * 4. Custom routing rules
 */
export async function routeIncomingCall(call: IncomingCallInfo): Promise<CallRouteResult> {
  logger.info({
    callId: call.callId,
    from: call.from.slice(-4),
    to: call.to,
    provider: call.provider,
    msg: 'sip.routing_call',
  });

  // Check if DID is configured
  const didConfig = getDIDConfig(call.to);
  if (!didConfig) {
    logger.warn({ to: call.to, msg: 'sip.unknown_did' });
    return {
      accept: false,
      rejectReason: 'Unknown DID number',
    };
  }

  // Check for blocked callers
  if (await isCallerBlocked(call.from)) {
    logger.warn({ from: call.from.slice(-4), msg: 'sip.blocked_caller' });
    return {
      accept: false,
      rejectReason: 'Caller blocked',
    };
  }

  // Determine agent based on DID routing
  const agentId = didConfig.agentId || 'call_center';
  const language = detectLanguageFromCaller(call.from) || 'en-US';

  return {
    accept: true,
    agentId,
    language,
    voiceStyle: didConfig.voiceStyle || 'alloy',
    systemPrompt: didConfig.systemPrompt,
    metadata: {
      provider: call.provider,
      did: call.to,
      sipCallId: call.callId,
    },
  };
}

/**
 * DID number configuration
 */
interface DIDConfig {
  number: string;
  agentId?: string;
  voiceStyle?: string;
  systemPrompt?: string;
  department?: string;
}

/**
 * Get configuration for a DID number
 */
function getDIDConfig(didNumber: string): DIDConfig | null {
  // Normalize DID number
  const normalized = normalizePhoneNumber(didNumber);
  
  // Check against configured DIDs
  // In production, this would query a database
  const configuredDIDs = config.VOICE_DID_NUMBERS;
  
  for (const did of configuredDIDs) {
    const parts = did.includes(':') ? did.split(':') : ['', did];
    const number = parts[1] || parts[0];
    if (normalizePhoneNumber(number) === normalized) {
      return {
        number: normalized,
        agentId: 'call_center',
      };
    }
  }

  // Allow all DIDs in development
  if (process.env.NODE_ENV === 'development') {
    return {
      number: normalized,
      agentId: 'call_center',
    };
  }

  return null;
}

/**
 * Check if a caller is blocked
 */
async function isCallerBlocked(_phoneNumber: string): Promise<boolean> {
  // In production, this would check a blocklist database
  // For now, return false (no blocking)
  return false;
}

/**
 * Detect preferred language from caller's phone number
 */
function detectLanguageFromCaller(phoneNumber: string): string {
  // Rwanda country code
  if (phoneNumber.startsWith('+250') || phoneNumber.startsWith('250')) {
    return 'rw-RW'; // Kinyarwanda
  }
  
  // Kenya
  if (phoneNumber.startsWith('+254') || phoneNumber.startsWith('254')) {
    return 'sw-KE'; // Swahili (Kenya)
  }
  
  // Default to English
  return 'en-US';
}

/**
 * Normalize phone number to E.164 format
 */
function normalizePhoneNumber(phone: string): string {
  // Check if already has + prefix (before stripping)
  const hasPlus = phone.startsWith('+');
  
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');
  
  // If doesn't have + prefix, add country code if needed
  if (!hasPlus) {
    // Assume Rwanda country code if 10 digits starting with 07
    if (digits.length === 10 && digits.startsWith('07')) {
      digits = '250' + digits.substring(1);
    }
    // Otherwise assume international format if starts with country code
  }
  
  return '+' + digits;
}

/**
 * Validate SIP credentials
 */
export function validateSIPCredentials(provider: SIPProvider): boolean {
  const trunkConfig = getSIPTrunkConfig(provider);
  if (!trunkConfig || !trunkConfig.enabled) {
    return false;
  }

  const hasCredentials = Boolean(
    trunkConfig.endpoint &&
    trunkConfig.username &&
    trunkConfig.password
  );

  if (!hasCredentials) {
    logger.warn({ provider, msg: 'sip.missing_credentials' });
  }

  return hasCredentials;
}

/**
 * Build SIP URI for outbound dialing
 */
export function buildSIPURI(phoneNumber: string, provider: SIPProvider): string | null {
  const trunkConfig = getSIPTrunkConfig(provider);
  if (!trunkConfig || !trunkConfig.enabled) {
    return null;
  }

  const normalized = normalizePhoneNumber(phoneNumber);
  const [host, port] = trunkConfig.endpoint.split(':');
  
  return `sip:${normalized.replace('+', '')}@${host}:${port || 5060}`;
}
