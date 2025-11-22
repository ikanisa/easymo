/**
 * General Broker Agent Tools
 * 
 * Tools for managing user memory, service requests, and vendor discovery
 */

import { z } from 'zod';

import type { AgentContext,ToolDefinition } from '../types';

const AGENT_TOOLS_ENDPOINT = process.env.SUPABASE_URL
  ? `${process.env.SUPABASE_URL}/functions/v1/agent-tools-general-broker`
  : 'http://localhost:54321/functions/v1/agent-tools-general-broker';

/**
 * Get user's saved locations (home/work/school)
 */
export const getUserLocationsTool: ToolDefinition = {
  name: 'get_user_locations',
  description: 'Retrieve all saved locations for the user (home, work, school). Always check this first to avoid re-asking for location.',
  parameters: z.object({}),
  async execute(params: unknown, context: AgentContext) {
    const response = await fetch(AGENT_TOOLS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'get_user_locations',
        userId: context.userId,
      }),
    });
    return await response.json();
  },
};

/**
 * Save or update user location
 */
export const upsertUserLocationTool: ToolDefinition = {
  name: 'upsert_user_location',
  description: 'Save or update a user location (home, work, school, or other). Use this when user shares a location pin or address.',
  parameters: z.object({
    label: z.enum(['home', 'work', 'school', 'other']).optional().describe('Location label'),
    latitude: z.number().describe('Latitude coordinate'),
    longitude: z.number().describe('Longitude coordinate'),
    address: z.string().optional().describe('Human-readable address'),
    isDefault: z.boolean().optional().describe('Set as default location'),
  }),
  async execute(params: unknown, context: AgentContext) {
    const response = await fetch(AGENT_TOOLS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upsert_user_location',
        userId: context.userId,
        ...(params as Record<string, unknown>),
      }),
    });
    return await response.json();
  },
};

/**
 * Get user facts (persistent memory)
 */
export const getUserFactsTool: ToolDefinition = {
  name: 'get_user_facts',
  description: 'Retrieve stored user preferences and facts (language, budget preferences, etc) to avoid re-asking.',
  parameters: z.object({
    keys: z.array(z.string()).optional().describe('Optional: specific fact keys to retrieve'),
  }),
  async execute(params: unknown, context: AgentContext) {
    const response = await fetch(AGENT_TOOLS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'get_user_facts',
        userId: context.userId,
        ...(params as Record<string, unknown>),
      }),
    });
    return await response.json();
  },
};

/**
 * Record a service request
 */
export const recordServiceRequestTool: ToolDefinition = {
  name: 'record_service_request',
  description: 'Create a structured service request record for ANY user ask (buy laptop, find house, get insurance, etc). MUST be called for every meaningful request.',
  parameters: z.object({
    vertical: z.enum(['mobility', 'commerce', 'hospitality', 'insurance', 'property', 'legal', 'jobs', 'farming', 'marketing', 'sora_video', 'support']).describe('Service vertical'),
    requestType: z.string().describe('Type: buy, book, quote, search, onboard_vendor, etc'),
    category: z.string().optional().describe('Category within vertical'),
    subcategory: z.string().optional().describe('Subcategory if applicable'),
    title: z.string().optional().describe('Brief title of request'),
    description: z.string().optional().describe('Full description'),
    locationId: z.string().optional().describe('Reference to saved location'),
    payload: z.record(z.any()).optional().describe('Additional structured data'),
  }),
  async execute(params: unknown, context: AgentContext) {
    const response = await fetch(AGENT_TOOLS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'record_service_request',
        userId: context.userId,
        orgId: (context as any).orgId,
        ...(params as Record<string, unknown>),
      }),
    });
    return await response.json();
  },
};

/**
 * Find vendors near a location
 */
export const findVendorsNearbyTool: ToolDefinition = {
  name: 'find_vendors_nearby',
  description: 'Find EasyMO-registered vendors near a location. ONLY use vendors from this tool - NEVER invent vendors.',
  parameters: z.object({
    vertical: z.enum(['commerce', 'hospitality', 'insurance', 'property', 'legal', 'farming', 'marketing']).describe('Service vertical'),
    category: z.string().optional().describe('Optional: filter by category'),
    latitude: z.number().optional().describe('Latitude'),
    longitude: z.number().optional().describe('Longitude'),
    radiusKm: z.number().optional().describe('Search radius in km (default 10)'),
    limit: z.number().optional().describe('Max results (default 10)'),
  }),
  async execute(params: unknown, context: AgentContext) {
    const response = await fetch(AGENT_TOOLS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'find_vendors_nearby',
        userId: context.userId,
        ...(params as Record<string, unknown>),
      }),
    });
    return await response.json();
  },
};

/**
 * Search EasyMO FAQ
 */
export const searchFAQTool: ToolDefinition = {
  name: 'search_easymo_faq',
  description: 'Search EasyMO platform FAQs for questions about how EasyMO works, pricing, supported countries, etc.',
  parameters: z.object({
    query: z.string().describe('Search query'),
    locale: z.enum(['en', 'fr', 'rw', 'sw', 'ln']).optional().describe('Language (default: en)'),
  }),
  async execute(params: unknown, context: AgentContext) {
    const response = await fetch(AGENT_TOOLS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'search_easymo_faq',
        userId: context.userId,
        ...(params as Record<string, unknown>),
      }),
    });
    return await response.json();
  },
};

/**
 * Search service catalog
 */
export const searchServiceCatalogTool: ToolDefinition = {
  name: 'search_service_catalog',
  description: 'Search EasyMO service catalog to learn about available services and capabilities.',
  parameters: z.object({
    query: z.string().describe('Search query'),
  }),
  async execute(params: unknown, context: AgentContext) {
    const response = await fetch(AGENT_TOOLS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'search_service_catalog',
        userId: context.userId,
        ...(params as Record<string, unknown>),
      }),
    });
    return await response.json();
  },
};
