import { Injectable } from '@nestjs/common';
import { env } from '../../common/env';
import {
  AGENT_PROFILES,
  AgentProfileDefinition,
  AgentProfileKey,
  DEFAULT_AGENT_PROFILE,
  isAgentProfileKey,
} from './agent-profiles';

function selectProfile(key: AgentProfileKey | undefined): AgentProfileDefinition {
  if (key && AGENT_PROFILES[key]) {
    return AGENT_PROFILES[key];
  }
  return AGENT_PROFILES[DEFAULT_AGENT_PROFILE];
}

interface AgentResolveResult {
  key: AgentProfileKey;
  definition: AgentProfileDefinition;
  /**
   * True when the selected profile was derived from an explicit request payload hint.
   */
  confidence: 'explicit' | 'mapped' | 'default';
}

@Injectable()
export class AgentProfileResolver {
  resolveFromWebhook(body: any): AgentResolveResult {
    // Highest priority: explicit agent_profile in payload metadata
    const explicit =
      typeof body?.agent_profile === 'string'
        ? body.agent_profile
        : typeof body?.metadata?.agent_profile === 'string'
          ? body.metadata.agent_profile
          : undefined;

    if (isAgentProfileKey(explicit)) {
      return { key: explicit, definition: selectProfile(explicit), confidence: 'explicit' };
    }

    // Map by project id (one project can drive specific persona)
    const projectId = typeof body?.project_id === 'string' ? body.project_id : undefined;
    if (projectId) {
      const mapped = env.voiceAgentProjectMap[projectId];
      if (isAgentProfileKey(mapped)) {
        return { key: mapped, definition: selectProfile(mapped), confidence: 'mapped' };
      }
    }

    // Map by caller/callee numbers when provided
    const msisdn = typeof body?.from === 'string' ? body.from : undefined;
    const toNumber = typeof body?.to === 'string' ? body.to : undefined;
    if (msisdn) {
      const mapped = env.voiceAgentNumberMap[msisdn];
      if (isAgentProfileKey(mapped)) {
        return { key: mapped, definition: selectProfile(mapped), confidence: 'mapped' };
      }
    }
    if (toNumber) {
      const mapped = env.voiceAgentNumberMap[toNumber];
      if (isAgentProfileKey(mapped)) {
        return { key: mapped, definition: selectProfile(mapped), confidence: 'mapped' };
      }
    }

    // Default fallback from env or code constant
    const fallback = env.voiceAgentDefault;
    const fallbackKey = isAgentProfileKey(fallback) ? fallback : DEFAULT_AGENT_PROFILE;
    return { key: fallbackKey, definition: selectProfile(fallbackKey), confidence: 'default' };
  }
}

