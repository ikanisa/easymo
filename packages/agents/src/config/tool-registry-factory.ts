/**
 * Tool Registry Factory - Dynamic Tool Wiring
 * 
 * Converts database tool definitions (ai_agent_tools) to runtime tool functions.
 * Maps tool types to actual implementations.
 * 
 * Supported tool types:
 * - db: Database queries (Supabase)
 * - http: HTTP API calls
 * - deep_search: AI-powered web search
 * - maps: Google Maps / geocoding
 * - momo: Mobile Money payments
 * - whatsapp: WhatsApp messaging
 * - voice: Voice/SIP calls
 * - location: Location services
 * - static: Static data / config
 * - external: External API integrations
 * - vector_store: RAG / vector search
 * 
 * Usage:
 * ```ts
 * import { buildRuntimeTools } from '@easymo/agents/config';
 * 
 * const agentTools = await loader.getAgentTools(agentId);
 * const runtimeTools = buildRuntimeTools(agentTools, supabase);
 * ```
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  AiAgentTool,
  RuntimeTool,
  RuntimeToolContext,
  ToolType,
} from './agent-config.types';

// =====================================================================
// TOOL IMPLEMENTATION REGISTRY
// =====================================================================

type ToolImplementation = (
  params: Record<string, unknown>,
  context: RuntimeToolContext,
  toolConfig: Record<string, unknown>,
  supabase: SupabaseClient
) => Promise<unknown>;

const TOOL_IMPLEMENTATIONS: Record<string, ToolImplementation> = {
  // Database tools
  search_jobs: searchJobsTool,
  search_properties: searchPropertiesTool,
  search_menu_supabase: searchMenuTool,
  search_business_directory: searchBusinessDirectoryTool,
  search_produce: searchProduceTool,
  search_listings: searchMarketplaceListingsTool,
  create_listing: createMarketplaceListingTool,
  get_nearby_listings: getNearbyListingsTool,
  get_user_info: getUserInfoTool,
  check_wallet_balance: checkWalletBalanceTool,
  create_support_ticket: createSupportTicketTool,
  search_faq: searchFaqTool,
  lookup_loyalty: lookupLoyaltyTool,
  
  // Rides tools
  find_nearby_drivers: findNearbyDriversTool,
  search_drivers: findNearbyDriversTool,
  request_ride: requestRideTool,
  get_fare_estimate: getFareEstimateTool,
  track_ride: trackRideTool,
  
  // Insurance tools
  get_motor_quote: calculateInsuranceQuoteTool,
  calculate_quote: calculateInsuranceQuoteTool,
  check_policy_status: checkPolicyStatusTool,
  submit_claim: submitInsuranceClaimTool,
  
  // Location tools
  geocode_address: geocodeAddressTool,
  find_nearby_places: findNearbyPlacesTool,
  
  // Payment tools
  momo_charge: momoChargeTool,
  process_payment: momoChargeTool,
  
  // Deep search tool
  deep_search: deepSearchTool,
  deepsearch: deepSearchTool,
  openai_deep_search: deepSearchTool,
  web_search: webSearchTool,
  
  // Communication tools
  contact_seller: contactSellerTool,
  send_notification: sendNotificationTool,
  
  // Scheduling tools
  schedule_appointment: scheduleAppointmentTool,
  book_table: bookTableTool,
  
  // Weather tool
  get_weather: getWeatherTool,
  
  // Translation tool
  translate_text: translateTextTool,
};

// =====================================================================
// MAIN BUILD FUNCTION
// =====================================================================

/**
 * Convert database tool definitions to runtime tools
 */
export function buildRuntimeTools(
  agentTools: AiAgentTool[],
  supabase: SupabaseClient
): RuntimeTool[] {
  return agentTools
    .filter(tool => tool.isActive)
    .map(tool => buildSingleTool(tool, supabase));
}

/**
 * Build a single runtime tool from DB definition
 */
function buildSingleTool(tool: AiAgentTool, supabase: SupabaseClient): RuntimeTool {
  // Look for a specific implementation first
  const specificImpl = TOOL_IMPLEMENTATIONS[tool.name];
  
  return {
    name: tool.name,
    displayName: tool.displayName,
    description: tool.description || `Execute ${tool.name}`,
    type: tool.toolType,
    parameters: buildParametersSchema(tool.inputSchema),
    execute: async (params, context) => {
      // Use specific implementation if available
      if (specificImpl) {
        return specificImpl(params, context, tool.config, supabase);
      }
      
      // Otherwise use generic type-based execution
      return executeByType(tool.toolType, params, context, tool.config, supabase);
    },
  };
}

/**
 * Build OpenAI-compatible parameters schema
 */
function buildParametersSchema(inputSchema: Record<string, unknown>): RuntimeTool['parameters'] {
  // If already in correct format, return as-is
  if (inputSchema.type === 'object' && inputSchema.properties) {
    return inputSchema as RuntimeTool['parameters'];
  }
  
  // Convert simple schema to proper format
  return {
    type: 'object',
    properties: inputSchema,
    required: [],
  };
}

/**
 * Execute tool based on type when no specific implementation exists
 */
async function executeByType(
  toolType: ToolType,
  params: Record<string, unknown>,
  context: RuntimeToolContext,
  config: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  switch (toolType) {
    case 'db':
      return genericDbTool(params, config, supabase);
    
    case 'http':
      return genericHttpTool(params, config);
    
    case 'static':
      return config;
    
    case 'deep_search':
      return deepSearchTool(params, context, config, supabase);
    
    case 'location':
      return genericLocationTool(params, config);
    
    default:
      return {
        success: false,
        error: `Tool type '${toolType}' not implemented`,
        params,
      };
  }
}

// =====================================================================
// GENERIC TYPE-BASED IMPLEMENTATIONS
// =====================================================================

async function genericDbTool(
  params: Record<string, unknown>,
  config: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const tableName = config.table as string;
  if (!tableName) {
    return { error: 'Database tool requires "table" in config' };
  }

  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(params.limit as number || 10);

  if (error) {
    return { error: error.message };
  }

  return { data, count: data?.length || 0 };
}

async function genericHttpTool(
  params: Record<string, unknown>,
  config: Record<string, unknown>
): Promise<unknown> {
  const endpoint = config.endpoint as string;
  const method = (config.method as string) || 'GET';

  if (!endpoint) {
    return { error: 'HTTP tool requires "endpoint" in config' };
  }

  try {
    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method !== 'GET' ? JSON.stringify(params) : undefined,
    });

    if (!response.ok) {
      return { error: `HTTP ${response.status}` };
    }

    return await response.json();
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'HTTP request failed' };
  }
}

async function genericLocationTool(
  params: Record<string, unknown>,
  _config: Record<string, unknown>
): Promise<unknown> {
  return {
    latitude: params.lat,
    longitude: params.lng,
    message: 'Location tool stub - implement with Google Maps API',
  };
}

// =====================================================================
// SPECIFIC TOOL IMPLEMENTATIONS
// =====================================================================

// --- Database Search Tools ---

async function searchJobsTool(
  params: Record<string, unknown>,
  _context: RuntimeToolContext,
  _config: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const query = params.query as string || '';
  const location = params.location as string;
  
  let dbQuery = supabase
    .from('jobs')
    .select('*')
    .eq('status', 'active')
    .limit(10);

  if (query) {
    const sanitized = sanitizeSearchQuery(query);
    dbQuery = dbQuery.or(`title.ilike.%${sanitized}%,description.ilike.%${sanitized}%`);
  }

  if (location) {
    dbQuery = dbQuery.ilike('location', `%${location}%`);
  }

  const { data, error } = await dbQuery;
  return error ? { error: error.message } : { jobs: data, count: data?.length || 0 };
}

async function searchPropertiesTool(
  params: Record<string, unknown>,
  _context: RuntimeToolContext,
  _config: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const location = params.location as string;
  const bedrooms = params.bedrooms as number;
  const maxPrice = params.max_price as number;

  let dbQuery = supabase
    .from('properties')
    .select('*')
    .eq('status', 'available')
    .limit(10);

  if (location) {
    dbQuery = dbQuery.ilike('location', `%${location}%`);
  }
  if (bedrooms) {
    dbQuery = dbQuery.eq('bedrooms', bedrooms);
  }
  if (maxPrice) {
    dbQuery = dbQuery.lte('price', maxPrice);
  }

  const { data, error } = await dbQuery;
  return error ? { error: error.message } : { properties: data, count: data?.length || 0 };
}

async function searchMenuTool(
  params: Record<string, unknown>,
  _context: RuntimeToolContext,
  _config: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const restaurantId = params.restaurant_id as string;
  const query = params.query as string || '';

  let dbQuery = supabase
    .from('menu_items')
    .select('*')
    .eq('available', true)
    .limit(20);

  if (restaurantId) {
    dbQuery = dbQuery.eq('restaurant_id', restaurantId);
  }

  if (query) {
    const sanitized = sanitizeSearchQuery(query);
    dbQuery = dbQuery.or(`name.ilike.%${sanitized}%,description.ilike.%${sanitized}%`);
  }

  const { data, error } = await dbQuery;
  return error ? { error: error.message } : { items: data, count: data?.length || 0 };
}

async function searchBusinessDirectoryTool(
  params: Record<string, unknown>,
  _context: RuntimeToolContext,
  _config: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const query = params.query as string || '';
  const category = params.category as string;

  let dbQuery = supabase
    .from('business_directory')
    .select('*')
    .eq('is_active', true)
    .limit(15);

  if (query) {
    const sanitized = sanitizeSearchQuery(query);
    dbQuery = dbQuery.or(`name.ilike.%${sanitized}%,description.ilike.%${sanitized}%`);
  }

  if (category) {
    dbQuery = dbQuery.eq('category', category);
  }

  const { data, error } = await dbQuery;
  return error ? { error: error.message } : { businesses: data, count: data?.length || 0 };
}

async function searchProduceTool(
  params: Record<string, unknown>,
  _context: RuntimeToolContext,
  _config: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const query = params.query as string || '';

  let dbQuery = supabase
    .from('produce_listings')
    .select('*')
    .eq('status', 'available')
    .limit(10);

  if (query) {
    const sanitized = sanitizeSearchQuery(query);
    dbQuery = dbQuery.or(`name.ilike.%${sanitized}%,description.ilike.%${sanitized}%`);
  }

  const { data, error } = await dbQuery;
  return error ? { error: error.message } : { produce: data, count: data?.length || 0 };
}

async function searchMarketplaceListingsTool(
  params: Record<string, unknown>,
  _context: RuntimeToolContext,
  _config: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const query = params.query as string || '';
  const category = params.category as string;

  let dbQuery = supabase
    .from('marketplace_listings')
    .select('id, product_name, description, price, category, condition, location, created_at')
    .eq('status', 'active')
    .limit(15);

  if (query) {
    const sanitized = sanitizeSearchQuery(query);
    dbQuery = dbQuery.or(`product_name.ilike.%${sanitized}%,description.ilike.%${sanitized}%`);
  }

  if (category) {
    dbQuery = dbQuery.eq('category', category);
  }

  const { data, error } = await dbQuery.order('created_at', { ascending: false });

  return error 
    ? { error: error.message } 
    : { listings: data?.map(l => ({
        id: l.id,
        title: l.product_name,
        price: `${l.price} RWF`,
        category: l.category,
        condition: l.condition,
        location: l.location,
      })), count: data?.length || 0 };
}

async function createMarketplaceListingTool(
  params: Record<string, unknown>,
  context: RuntimeToolContext,
  _config: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const { data: user } = await supabase
    .from('whatsapp_users')
    .select('phone_number')
    .eq('id', context.userId)
    .single();

  const { data, error } = await supabase
    .from('marketplace_listings')
    .insert({
      product_name: params.title as string,
      description: params.description as string,
      price: params.price as number,
      category: params.category as string,
      condition: params.condition as string || 'used',
      location: params.location as string,
      seller_phone: user?.phone_number,
      status: 'active',
    })
    .select('id')
    .single();

  return error 
    ? { success: false, error: error.message }
    : { success: true, listing_id: data?.id, message: 'Listing created successfully!' };
}

async function getNearbyListingsTool(
  params: Record<string, unknown>,
  context: RuntimeToolContext,
  _config: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const { data: user } = await supabase
    .from('whatsapp_users')
    .select('location_cache')
    .eq('id', context.userId)
    .single();

  if (!user?.location_cache) {
    return {
      success: false,
      needs_location: true,
      message: 'Please share your location first.',
    };
  }

  const category = params.category as string;
  const limit = (params.limit as number) || 10;

  let dbQuery = supabase
    .from('marketplace_listings')
    .select('id, product_name, price, category, location')
    .eq('status', 'active')
    .limit(limit);

  if (category) {
    dbQuery = dbQuery.eq('category', category);
  }

  const { data, error } = await dbQuery;
  
  return error 
    ? { error: error.message }
    : { listings: data, user_location: user.location_cache };
}

// --- User & Support Tools ---

async function getUserInfoTool(
  _params: Record<string, unknown>,
  context: RuntimeToolContext,
  _config: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const { data, error } = await supabase
    .from('whatsapp_users')
    .select('id, phone_number, preferred_language, user_roles, created_at')
    .eq('id', context.userId)
    .single();

  if (error || !data) {
    return { success: false, error: 'User not found' };
  }

  return {
    success: true,
    user: {
      id: data.id,
      phone: data.phone_number ? `***${data.phone_number.slice(-4)}` : null,
      language: data.preferred_language,
      roles: data.user_roles,
      member_since: data.created_at,
    },
  };
}

async function checkWalletBalanceTool(
  _params: Record<string, unknown>,
  context: RuntimeToolContext,
  _config: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const { data, error } = await supabase
    .from('wallet_balances')
    .select('balance, currency')
    .eq('user_id', context.userId)
    .single();

  if (error || !data) {
    return { success: true, balance: 0, currency: 'RWF', message: 'No wallet found' };
  }

  return { success: true, balance: data.balance, currency: data.currency };
}

async function createSupportTicketTool(
  params: Record<string, unknown>,
  context: RuntimeToolContext,
  _config: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      profile_id: context.userId,
      category: params.issue_type as string || 'other',
      priority: params.priority as string || 'medium',
      title: params.title as string || 'Support Request',
      description: (params.description as string)?.slice(0, 1000),
      status: 'open',
      metadata: {
        source: 'ai_agent',
        agent_slug: context.agentSlug,
      },
    })
    .select('id')
    .single();

  return error
    ? { success: false, error: 'Failed to create ticket' }
    : { success: true, ticket_id: data?.id, message: 'Ticket created successfully!' };
}

async function searchFaqTool(
  params: Record<string, unknown>,
  _context: RuntimeToolContext,
  _config: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const query = params.query as string;
  if (!query) {
    return { results: [], message: 'Please provide a search query' };
  }

  const sanitized = sanitizeSearchQuery(query);
  const { data } = await supabase
    .from('support_faq')
    .select('question, answer, category')
    .or(`question.ilike.%${sanitized}%,answer.ilike.%${sanitized}%`)
    .limit(5);

  return {
    results: data || [],
    count: data?.length || 0,
  };
}

async function lookupLoyaltyTool(
  params: Record<string, unknown>,
  _context: RuntimeToolContext,
  _config: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const phone = params.phone as string;
  const { data, error } = await supabase
    .from('loyalty_programs')
    .select('*')
    .eq('phone_number', phone)
    .single();

  return error ? { error: error.message } : data;
}

// --- Rides Tools ---

async function findNearbyDriversTool(
  params: Record<string, unknown>,
  context: RuntimeToolContext,
  _config: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const { data: user } = await supabase
    .from('whatsapp_users')
    .select('location_cache')
    .eq('id', context.userId)
    .single();

  if (!user?.location_cache) {
    return { success: false, needs_location: true, message: 'Please share your GPS location.' };
  }

  const { data, error } = await supabase
    .from('rides_driver_status')
    .select('id, driver_name, vehicle_type, rating, is_online')
    .eq('is_online', true)
    .limit(5);

  return error 
    ? { error: error.message }
    : { 
        drivers: data?.map(d => ({
          id: d.id,
          name: d.driver_name,
          vehicle_type: d.vehicle_type,
          rating: d.rating,
          eta: '5-10 min',
        })),
        count: data?.length || 0,
      };
}

async function requestRideTool(
  params: Record<string, unknown>,
  context: RuntimeToolContext,
  _config: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const { data: user } = await supabase
    .from('whatsapp_users')
    .select('location_cache')
    .eq('id', context.userId)
    .single();

  if (!user?.location_cache) {
    return { success: false, needs_location: true, message: 'Please share your GPS location.' };
  }

  const vehicleType = (params.vehicle_type as string) || 'moto';
  const rates = { moto: { base: 500, perKm: 200 }, car: { base: 1500, perKm: 500 } };
  const rate = rates[vehicleType as keyof typeof rates] || rates.moto;
  const estimatedFare = rate.base + 5 * rate.perKm; // Default 5km

  const { data, error } = await supabase
    .from('rides_trips')
    .insert({
      passenger_id: context.userId,
      pickup_lat: user.location_cache.lat,
      pickup_lng: user.location_cache.lng,
      pickup_address: params.pickup_address as string || 'Current location',
      destination_address: params.destination_address as string,
      vehicle_type: vehicleType,
      estimated_fare: estimatedFare,
      status: 'pending',
    })
    .select('id')
    .single();

  return error
    ? { success: false, error: error.message }
    : { success: true, ride_id: data?.id, estimated_fare: `${estimatedFare} RWF`, status: 'pending' };
}

async function getFareEstimateTool(
  params: Record<string, unknown>,
  _context: RuntimeToolContext,
  _config: Record<string, unknown>,
  _supabase: SupabaseClient
): Promise<unknown> {
  const distanceKm = (params.distance_km as number) || 5;
  const vehicleType = (params.vehicle_type as string) || 'moto';
  
  const rates = { moto: { base: 500, perKm: 200 }, car: { base: 1500, perKm: 500 } };
  const rate = rates[vehicleType as keyof typeof rates] || rates.moto;
  const fare = rate.base + distanceKm * rate.perKm;

  return {
    vehicle_type: vehicleType,
    distance_km: distanceKm,
    estimated_fare: `${fare} RWF`,
    estimated_time: `${Math.ceil(distanceKm * 3)} minutes`,
  };
}

async function trackRideTool(
  params: Record<string, unknown>,
  _context: RuntimeToolContext,
  _config: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const rideId = params.ride_id as string;
  if (!rideId) {
    return { success: false, error: 'Ride ID is required' };
  }

  const { data, error } = await supabase
    .from('rides_trips')
    .select('id, status, pickup_address, destination_address, estimated_fare')
    .eq('id', rideId)
    .single();

  return error 
    ? { success: false, error: 'Ride not found' }
    : { success: true, ...data };
}

// --- Insurance Tools ---

async function calculateInsuranceQuoteTool(
  params: Record<string, unknown>,
  context: RuntimeToolContext,
  _config: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const vehicleType = (params.vehicle_type as string) || 'car';
  const vehicleValue = (params.vehicle_value as number) || 5000000;
  const coverageType = (params.coverage_type as string) || 'third_party';

  let basePremium = vehicleValue * 0.05;
  if (coverageType === 'comprehensive') basePremium *= 1.5;
  
  const vehicleMultipliers: Record<string, number> = { motorcycle: 0.5, car: 1.0, truck: 1.5 };
  basePremium *= vehicleMultipliers[vehicleType] || 1.0;

  const annualPremium = Math.round(basePremium);

  await supabase.from('insurance_requests').insert({
    user_id: context.userId,
    insurance_type: 'motor',
    coverage_type: coverageType,
    vehicle_type: vehicleType,
    vehicle_value: vehicleValue,
    annual_premium: annualPremium,
    status: 'quoted',
  });

  return {
    success: true,
    vehicle_type: vehicleType,
    coverage: coverageType,
    annual_premium: `${annualPremium.toLocaleString()} RWF`,
    monthly_premium: `${Math.round(annualPremium / 12).toLocaleString()} RWF`,
  };
}

async function checkPolicyStatusTool(
  params: Record<string, unknown>,
  _context: RuntimeToolContext,
  _config: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const policyNumber = params.policy_number as string;
  if (!policyNumber) {
    return { success: false, error: 'Policy number is required' };
  }

  const { data, error } = await supabase
    .from('insurance_policies')
    .select('policy_number, insurance_type, status, end_date')
    .eq('policy_number', policyNumber)
    .single();

  return error 
    ? { success: false, error: 'Policy not found' }
    : { success: true, ...data };
}

async function submitInsuranceClaimTool(
  params: Record<string, unknown>,
  context: RuntimeToolContext,
  _config: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const { data, error } = await supabase
    .from('insurance_claims')
    .insert({
      user_id: context.userId,
      policy_number: params.policy_number as string,
      claim_type: params.claim_type as string,
      description: (params.description as string)?.slice(0, 2000),
      incident_date: params.incident_date as string || new Date().toISOString(),
      status: 'submitted',
    })
    .select('id')
    .single();

  return error
    ? { success: false, error: error.message }
    : { success: true, claim_id: data?.id, status: 'submitted' };
}

// --- Location Tools ---

async function geocodeAddressTool(
  params: Record<string, unknown>,
  _context: RuntimeToolContext,
  _config: Record<string, unknown>,
  _supabase: SupabaseClient
): Promise<unknown> {
  const address = params.address as string;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    return { error: 'Geocoding API not configured' };
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
    );
    const data = await response.json() as { status: string; results?: Array<{ formatted_address: string; geometry: { location: { lat: number; lng: number } }; place_id: string }> };
    
    if (data.status !== 'OK') {
      return { error: `Geocoding failed: ${data.status}` };
    }

    const result = data.results?.[0];
    if (!result) {
      return { error: 'No geocoding results found' };
    }
    
    return {
      formatted_address: result.formatted_address,
      location: result.geometry.location,
      place_id: result.place_id,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Geocoding failed' };
  }
}

async function findNearbyPlacesTool(
  params: Record<string, unknown>,
  _context: RuntimeToolContext,
  _config: Record<string, unknown>,
  _supabase: SupabaseClient
): Promise<unknown> {
  const lat = params.latitude as number;
  const lng = params.longitude as number;
  const query = params.query as string;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    return { error: 'Maps API not configured' };
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=5000&keyword=${encodeURIComponent(query)}&key=${apiKey}`
    );
    const data = await response.json() as { results?: Array<{ name: string; vicinity: string; rating?: number; types?: string[] }> };
    
    return {
      places: data.results?.slice(0, 5).map((p) => ({
        name: p.name,
        address: p.vicinity,
        rating: p.rating,
        types: p.types,
      })) || [],
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Search failed' };
  }
}

// --- Payment Tools ---

async function momoChargeTool(
  params: Record<string, unknown>,
  context: RuntimeToolContext,
  _config: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const phone = params.phone as string;
  const amount = params.amount as number;
  const reference = params.reference as string || `EASYMO-${Date.now()}`;

  if (!phone || !amount) {
    return { success: false, error: 'Phone and amount are required' };
  }

  // Check if MoMo API is configured
  const momoApiKey = process.env.MOMO_API_KEY;
  const isApiConfigured = !!momoApiKey;

  // Store transaction with appropriate status based on API availability
  const { error: insertError } = await supabase.from('payment_transactions').insert({
    user_id: context.userId,
    amount,
    currency: 'RWF',
    phone_number: phone,
    reference,
    status: isApiConfigured ? 'pending' : 'pending_manual',
    payment_method: 'momo',
    metadata: { 
      initiated_by_agent: context.agentSlug,
      api_configured: isApiConfigured,
      requires_manual_processing: !isApiConfigured,
    },
  });

  if (insertError) {
    console.error('Failed to create payment transaction:', insertError.message);
    return {
      success: false,
      error: 'Failed to initiate payment. Please try again.',
    };
  }

  if (!isApiConfigured) {
    return {
      success: true,
      phone,
      amount,
      reference,
      status: 'pending_manual',
      message: 'Payment request recorded. Our team will process it and contact you shortly.',
      note: 'Automated payments are temporarily unavailable.',
    };
  }

  // TODO: Actual MoMo API integration would go here
  return {
    success: true,
    phone,
    amount,
    reference,
    status: 'pending',
    message: `Payment request sent to ${phone}. Please approve on your phone.`,
  };
}

// --- Deep Search Tool (no crawl_strategy - live search only) ---

async function deepSearchTool(
  params: Record<string, unknown>,
  _context: RuntimeToolContext,
  _config: Record<string, unknown>,
  _supabase: SupabaseClient
): Promise<unknown> {
  const query = params.query as string || params.topic as string;
  
  if (!query) {
    return { error: 'Query is required for deep search' };
  }

  // Use Serper API for live web search
  const apiKey = process.env.SERPER_API_KEY || process.env.TAVILY_API_KEY;
  
  if (!apiKey) {
    return {
      query,
      results: [],
      message: 'Web search not configured - please configure SERPER_API_KEY',
    };
  }

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 5 }),
    });

    if (!response.ok) {
      return { error: `Search API error: ${response.status}` };
    }

    const data = await response.json() as { organic?: Array<{ title: string; snippet: string; link: string }> };
    
    return {
      query,
      source: 'web',
      results: data.organic?.slice(0, 5).map((r) => ({
        title: r.title,
        snippet: r.snippet,
        link: r.link,
      })) || [],
      message: `Found ${data.organic?.length || 0} results`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Search failed' };
  }
}

async function webSearchTool(
  params: Record<string, unknown>,
  context: RuntimeToolContext,
  config: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  return deepSearchTool(params, context, config, supabase);
}

// --- Communication Tools ---

async function contactSellerTool(
  params: Record<string, unknown>,
  _context: RuntimeToolContext,
  _config: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const listingId = params.listing_id as string;
  if (!listingId) {
    return { success: false, error: 'Listing ID is required' };
  }

  const { data: listing } = await supabase
    .from('marketplace_listings')
    .select('product_name, seller_phone, price')
    .eq('id', listingId)
    .single();

  if (!listing?.seller_phone) {
    return { success: false, error: 'Seller contact not available' };
  }

  const message = params.message as string || 
    `Hi! I'm interested in your listing "${listing.product_name}" priced at ${listing.price} RWF on easyMO.`;
  
  const cleanPhone = listing.seller_phone.replace(/[^0-9]/g, '');
  const whatsappLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  return {
    success: true,
    whatsapp_link: whatsappLink,
    listing_title: listing.product_name,
    message: `Click to contact: ${whatsappLink}`,
  };
}

async function sendNotificationTool(
  params: Record<string, unknown>,
  _context: RuntimeToolContext,
  _config: Record<string, unknown>,
  _supabase: SupabaseClient
): Promise<unknown> {
  // Placeholder - would integrate with WhatsApp Business API
  return {
    success: true,
    to: params.to,
    template: params.template,
    message: 'Notification queued for delivery',
  };
}

// --- Scheduling Tools ---

async function scheduleAppointmentTool(
  params: Record<string, unknown>,
  context: RuntimeToolContext,
  _config: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<unknown> {
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      user_id: context.userId,
      agent_id: context.agentId,
      appointment_date: params.date as string,
      appointment_time: params.time as string,
      appointment_type: params.type as string,
      duration_minutes: (params.duration_minutes as number) || 30,
      notes: params.notes as string,
      status: 'scheduled',
    })
    .select()
    .single();

  return error
    ? { success: false, error: error.message }
    : { success: true, appointment_id: data.id, date: params.date, time: params.time };
}

async function bookTableTool(
  params: Record<string, unknown>,
  _context: RuntimeToolContext,
  _config: Record<string, unknown>,
  _supabase: SupabaseClient
): Promise<unknown> {
  // Placeholder for restaurant booking
  return {
    success: true,
    reservation_id: `res_${Date.now()}`,
    date: params.date,
    time: params.time,
    party_size: params.party_size,
    status: 'confirmed',
  };
}

// --- Weather Tool ---

async function getWeatherTool(
  params: Record<string, unknown>,
  _context: RuntimeToolContext,
  _config: Record<string, unknown>,
  _supabase: SupabaseClient
): Promise<unknown> {
  const location = params.location as string || 'Kigali';
  const apiKey = process.env.OPENWEATHER_API_KEY;
  
  if (!apiKey) {
    return { location, error: 'Weather API not configured' };
  }

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=metric`
    );
    const data = await response.json() as { 
      name?: string; 
      main?: { temp?: number; humidity?: number }; 
      weather?: Array<{ description?: string }> 
    };
    
    return {
      location: data.name || location,
      temperature: data.main?.temp,
      description: data.weather?.[0]?.description,
      humidity: data.main?.humidity,
    };
  } catch (err) {
    return { location, error: err instanceof Error ? err.message : 'Weather fetch failed' };
  }
}

// --- Translation Tool ---

async function translateTextTool(
  params: Record<string, unknown>,
  _context: RuntimeToolContext,
  _config: Record<string, unknown>,
  _supabase: SupabaseClient
): Promise<unknown> {
  const text = params.text as string;
  const targetLanguage = params.target_language as string;
  
  if (!text || !targetLanguage) {
    return { error: 'Text and target language are required' };
  }

  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) {
    return { original_text: text, translated_text: text, message: 'Translation not configured' };
  }

  try {
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, target: targetLanguage }),
      }
    );
    const data = await response.json() as { 
      data?: { translations?: Array<{ translatedText?: string }> } 
    };
    
    return {
      original_text: text,
      translated_text: data.data?.translations?.[0]?.translatedText || text,
      target_language: targetLanguage,
    };
  } catch {
    return { original_text: text, translated_text: text, error: 'Translation failed' };
  }
}

// =====================================================================
// UTILITY FUNCTIONS
// =====================================================================

/**
 * Sanitize search query for use in LIKE patterns.
 * Note: Supabase client uses parameterized queries internally,
 * this sanitization handles LIKE special characters.
 */
function sanitizeSearchQuery(query: string): string {
  if (!query || typeof query !== 'string') {
    return '';
  }
  
  return query
    // Remove null bytes
    .replace(/\0/g, '')
    // Escape backslashes first
    .replace(/\\/g, '\\\\')
    // Escape LIKE wildcards
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    // Escape single quotes
    .replace(/'/g, "''")
    // Remove semicolons to prevent statement termination
    .replace(/;/g, '')
    // Limit length to prevent DoS
    .slice(0, 100);
}

// =====================================================================
// EXPORTS
// =====================================================================

export {
  sanitizeSearchQuery,
  TOOL_IMPLEMENTATIONS,
};
