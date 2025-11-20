/**
 * General Broker Agent Tools
 * 
 * Tools for managing user memory, service requests, and vendor discovery
 */

import type { ToolDefinition } from '../types';

const AGENT_TOOLS_ENDPOINT = process.env.SUPABASE_URL
  ? `${process.env.SUPABASE_URL}/functions/v1/agent-tools-general-broker`
  : 'http://localhost:54321/functions/v1/agent-tools-general-broker';

/**
 * Get user's saved locations (home/work/school)
 */
export const getUserLocationsTool: ToolDefinition = {
  name: 'get_user_locations',
  description: 'Retrieve all saved locations for the user (home, work, school). Always check this first to avoid re-asking for location.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  async execute(params: any, context: any) {
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
  parameters: {
    type: 'object',
    properties: {
      label: {
        type: 'string',
        enum: ['home', 'work', 'school', 'other'],
        description: 'Location label',
      },
      latitude: { type: 'number', description: 'Latitude coordinate' },
      longitude: { type: 'number', description: 'Longitude coordinate' },
      address: { type: 'string', description: 'Human-readable address' },
      isDefault: { type: 'boolean', description: 'Set as default location' },
    },
    required: ['latitude', 'longitude'],
  },
  async execute(params: any, context: any) {
    const response = await fetch(AGENT_TOOLS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upsert_user_location',
        userId: context.userId,
        ...params,
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
  parameters: {
    type: 'object',
    properties: {
      keys: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional: specific fact keys to retrieve',
      },
    },
    required: [],
  },
  async execute(params: any, context: any) {
    const response = await fetch(AGENT_TOOLS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'get_user_facts',
        userId: context.userId,
        ...params,
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
  parameters: {
    type: 'object',
    properties: {
      vertical: {
        type: 'string',
        enum: ['mobility', 'commerce', 'hospitality', 'insurance', 'property', 'legal', 'jobs', 'farming', 'marketing', 'sora_video', 'support'],
        description: 'Service vertical',
      },
      requestType: {
        type: 'string',
        description: 'Type: buy, book, quote, search, onboard_vendor, etc',
      },
      category: { type: 'string', description: 'Category within vertical' },
      subcategory: { type: 'string', description: 'Subcategory if applicable' },
      title: { type: 'string', description: 'Brief title of request' },
      description: { type: 'string', description: 'Full description' },
      locationId: { type: 'string', description: 'Reference to saved location' },
      payload: { type: 'object', description: 'Additional structured data' },
    },
    required: ['vertical', 'requestType'],
  },
  async execute(params: any, context: any) {
    const response = await fetch(AGENT_TOOLS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'record_service_request',
        userId: context.userId,
        orgId: context.orgId,
        ...params,
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
  parameters: {
    type: 'object',
    properties: {
      vertical: {
        type: 'string',
        enum: ['commerce', 'hospitality', 'insurance', 'property', 'legal', 'farming', 'marketing'],
        description: 'Service vertical',
      },
      category: { type: 'string', description: 'Optional: filter by category' },
      latitude: { type: 'number', description: 'Latitude' },
      longitude: { type: 'number', description: 'Longitude' },
      radiusKm: { type: 'number', description: 'Search radius in km (default 10)' },
      limit: { type: 'number', description: 'Max results (default 10)' },
    },
    required: ['vertical'],
  },
  async execute(params: any, context: any) {
    const response = await fetch(AGENT_TOOLS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'find_vendors_nearby',
        userId: context.userId,
        ...params,
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
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      locale: {
        type: 'string',
        enum: ['en', 'fr', 'rw', 'sw', 'ln'],
        description: 'Language (default: en)',
      },
    },
    required: ['query'],
  },
  async execute(params: any, context: any) {
    const response = await fetch(AGENT_TOOLS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'search_easymo_faq',
        userId: context.userId,
        ...params,
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
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
    },
    required: ['query'],
  },
  async execute(params: any, context: any) {
    const response = await fetch(AGENT_TOOLS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'search_service_catalog',
        userId: context.userId,
        ...params,
      }),
    });
    return await response.json();
  },
};
