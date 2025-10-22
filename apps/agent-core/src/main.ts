import 'dotenv/config';
import 'reflect-metadata';
import { Body, Controller, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import OpenAI from 'openai';
import type { ResponseIncludable } from 'openai/resources/responses/responses';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import type { LeadInput } from '@va/shared';
import { agentCoreControllerBasePath, getAgentCoreRouteSegment } from '@easymo/commons';

type WebSearchCallSummary = {
  id: string;
  status?: string;
  query?: string;
  domains?: string[];
  sources?: Array<{ url?: string; title?: string | null }>;
};

type Citation = {
  id: string;
  url: string;
  title?: string | null;
  startIndex?: number;
  endIndex?: number;
};

const toBoolean = (value: string | undefined | null, fallback = false) => {
  if (typeof value !== 'string') return fallback;
  const normalised = value.trim().toLowerCase();
  if (!normalised) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(normalised);
};

const parseDomains = (value: string | undefined | null) =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const buildUserLocation = () => {
  const country = process.env.WEB_SEARCH_LOCATION_COUNTRY ?? process.env.WEB_SEARCH_COUNTRY;
  const city = process.env.WEB_SEARCH_LOCATION_CITY ?? process.env.WEB_SEARCH_CITY;
  const region = process.env.WEB_SEARCH_LOCATION_REGION ?? process.env.WEB_SEARCH_REGION;
  const timezone = process.env.WEB_SEARCH_LOCATION_TIMEZONE ?? process.env.WEB_SEARCH_TIMEZONE;

  if (!country && !city && !region && !timezone) return undefined;
  const payload: Record<string, string> = { type: 'approximate' };
  if (country) payload.country = country;
  if (city) payload.city = city;
  if (region) payload.region = region;
  if (timezone) payload.timezone = timezone;
  return payload;
};

const webSearchEnabled = toBoolean(process.env.WEB_SEARCH_ENABLED ?? process.env.AGENT_WEB_SEARCH_ENABLED);
const allowedDomains = parseDomains(process.env.WEB_SEARCH_ALLOWED_DOMAINS);
const includeRawSources = toBoolean(process.env.WEB_SEARCH_INCLUDE_SOURCES, true);
const webSearchLocation = buildUserLocation();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const summariseWebSearchCalls = (payload: unknown): WebSearchCallSummary[] => {
  if (!payload || typeof payload !== 'object' || !('output' in payload)) return [];
  const raw = (payload as { output?: unknown }).output;
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((item): item is Record<string, any> => !!item && typeof item === 'object')
    .filter((item) => item.type === 'web_search_call')
    .map((item) => {
      const action = (item as any).web_search_call?.action ?? (item as any).action ?? {};
      const sources = Array.isArray(action.sources)
        ? action.sources.map((source: any) => ({
            url: typeof source?.url === 'string' ? source.url : undefined,
            title: typeof source?.title === 'string' ? source.title : null,
          }))
        : undefined;
      return {
        id: typeof item.id === 'string' ? item.id : randomUUID(),
        status: typeof item.status === 'string' ? item.status : undefined,
        query: typeof action.query === 'string' ? action.query : undefined,
        domains: Array.isArray(action.allowed_domains)
          ? action.allowed_domains.filter((domain: unknown): domain is string => typeof domain === 'string')
          : undefined,
        sources,
      } satisfies WebSearchCallSummary;
    });
};

const collectTextSegments = (payload: unknown) => {
  if (!payload || typeof payload !== 'object' || !('output' in payload)) return [] as Array<Record<string, any>>;
  const raw = (payload as { output?: unknown }).output;
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [] as Array<Record<string, any>>;
    if ((item as any).type === 'message' && Array.isArray((item as any).content)) {
      return (item as any).content.filter((content: unknown) => !!content && typeof content === 'object');
    }
    if ((item as any).type === 'output_text') return [item as Record<string, any>];
    return [] as Array<Record<string, any>>;
  });
};

const extractCitations = (payload: unknown): Citation[] => {
  const segments = collectTextSegments(payload);
  const annotations = segments
    .flatMap((segment) => (Array.isArray(segment.annotations) ? segment.annotations : []))
    .filter((annotation): annotation is Record<string, any> => !!annotation && typeof annotation === 'object')
    .filter((annotation) => annotation.type === 'url_citation' && typeof annotation.url === 'string');

  return annotations.map((annotation, index) => ({
    id: annotation.id && typeof annotation.id === 'string' ? annotation.id : `citation-${index + 1}`,
    url: annotation.url as string,
    title: typeof annotation.title === 'string' ? annotation.title : null,
    startIndex: typeof annotation.start_index === 'number' ? annotation.start_index : undefined,
    endIndex: typeof annotation.end_index === 'number' ? annotation.end_index : undefined,
  }));
};

const buildLeadTool = () => ({
  type: 'function' as const,
  name: 'upsertLead',
  description: 'Create or update a CRM lead attached to a call',
  strict: false,
  parameters: {
    type: 'object',
    properties: {
      phone: { type: 'string' },
      name: { type: 'string' },
      company: { type: 'string' },
      intent: { type: 'string' },
      notes: { type: 'string' },
      call_id: { type: 'string' },
    },
  },
});

@Controller(agentCoreControllerBasePath)
class AgentController {
  @Post(getAgentCoreRouteSegment('respond'))
  async respond(
    @Body()
    body: {
      messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
      call_id?: string;
      session_id?: string;
      agent_kind?: string;
    }
  ) {
    const toolset: any[] = [buildLeadTool()];
    if (webSearchEnabled) {
      const searchTool: Record<string, any> = { type: 'web_search' };
      if (allowedDomains.length > 0) {
        searchTool.filters = { allowed_domains: allowedDomains };
      }
      if (webSearchLocation) {
        searchTool.user_location = webSearchLocation;
      }
      toolset.push(searchTool);
    }

    const include = webSearchEnabled && includeRawSources
      ? (['web_search_call.action.sources'] as unknown as ResponseIncludable[])
      : undefined;

    const metadata: Record<string, string> = {};
    if (body.call_id) metadata.call_id = body.call_id;
    if (body.session_id) metadata.session_id = body.session_id;
    if (body.agent_kind) metadata.agent_kind = body.agent_kind;

    const response = await openai.responses.create({
      model: process.env.OPENAI_RESPONSES_MODEL || 'gpt-5',
      input: body.messages,
      tools: toolset,
      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      ...(include ? { include } : {}),
    });

    const outputs: Array<{ tool_call_id: string; output: string }> = [];

    const toolCalls = ((response.output as any[]) ?? []).filter(
      (item) => item?.type === 'tool_call' && item?.name === 'upsertLead'
    );

    for (const item of toolCalls) {
      const args = item.arguments as LeadInput;
      const payload = { ...args, call_id: args?.call_id ?? body.call_id };

      const { data } = await supabase
        .from('leads')
        .insert({
          phone: payload.phone,
          full_name: payload.name,
          company: payload.company,
          intent: payload.intent,
          notes: payload.notes,
          call_id: payload.call_id,
        })
        .select('*')
        .single();

      outputs.push({ tool_call_id: item.id as string, output: JSON.stringify(data) });
    }

    if (outputs.length && (openai as any)?.responses?.submitToolOutputs) {
      await (openai as any).responses.submitToolOutputs(response.id, {
        tool_outputs: outputs,
      });
    }

    const plainResponse = JSON.parse(JSON.stringify(response));
    const citations = extractCitations(plainResponse);
    const webSearchCalls = summariseWebSearchCalls(plainResponse);

    if (webSearchCalls.length > 0) {
      console.warn('agent-core.web-search', {
        call_id: body.call_id,
        session_id: body.session_id,
        agent_kind: body.agent_kind,
        searches: webSearchCalls.map((call) => ({
          id: call.id,
          query: call.query,
          domains: call.domains,
          status: call.status,
        })),
      });
    }

    return {
      text: (response.output_text ?? '').trim(),
      citations,
      web_search_calls: webSearchCalls,
      usage: response.usage ?? null,
      raw: plainResponse,
    };
  }
}

@Module({ controllers: [AgentController] })
class AgentModule {}

async function bootstrap() {
  const app = await NestFactory.create(AgentModule);
  await app.listen(Number(process.env.AGENT_CORE_PORT) || 3002);
  // eslint-disable-next-line no-console
  console.log(`agent-core listening on :${process.env.AGENT_CORE_PORT || 3002}`);
}

bootstrap();
