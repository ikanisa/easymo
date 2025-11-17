// Property Rental Agent
// Handles short-term and long-term rental matching, property listing, and price negotiation

import { serve } from "$std/http/server.ts";
import { createClient } from "@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface PropertySearchRequest {
  userId: string;
  action: "find" | "add";
  rentalType: "short_term" | "long_term";
  bedrooms?: number;
  minBudget?: number;
  maxBudget?: number;
  location: { latitude: number; longitude: number };
  address?: string;
  amenities?: string[];
  // Extended preferences (optional)
  furnished?: boolean;
  pets?: boolean;
  accessibility?: boolean;
  parking?: boolean;
  internetNeeds?: "basic" | "high" | "none";
  propertyTypes?: string[];
  // For adding property
  propertyData?: {
    price: number;
    bathrooms?: number;
    description?: string;
    images?: string[];
    availableFrom?: string;
  };
}

interface PropertyMatch {
  id: string;
  ownerId: string;
  type: string;
  bedrooms: number;
  bathrooms: number;
  price: number;
  location: any;
  address: string;
  amenities: string[];
  images: string[];
  distance: number;
  matchScore: number;
  negotiatedPrice?: number;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startTime = Date.now();

  try {
    const request: PropertySearchRequest = await req.json();
    
    console.log(JSON.stringify({
      event: "PROPERTY_AGENT_REQUEST",
      timestamp: new Date().toISOString(),
      userId: request.userId,
      action: request.action,
      rentalType: request.rentalType,
    }));

    // Create agent session
    const { data: session, error: sessionError } = await supabase
      .from("agent_sessions")
      .insert({
        user_id: request.userId,
        agent_type: "property_rental",
        flow_type: request.action === "add" ? "property_listing" : "property_search",
        status: "searching",
        request_data: request,
        deadline_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    if (request.action === "add") {
      return await handleAddProperty(supabase, request, session.id);
    } else {
      return await handleFindProperty(supabase, request, session.id);
    }
  } catch (error) {
    console.error(JSON.stringify({
      event: "PROPERTY_AGENT_ERROR",
      error: error.message,
      duration: Date.now() - startTime,
    }));

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleAddProperty(supabase: any, request: PropertySearchRequest, sessionId: string) {
  try {
    // Create property listing
    const { data: property, error } = await supabase
      .from("properties")
      .insert({
        owner_id: request.userId,
        rental_type: request.rentalType,
        bedrooms: request.propertyData?.bedrooms || request.bedrooms,
        bathrooms: request.propertyData?.bathrooms || 1,
        price: request.propertyData?.price || request.maxBudget,
        location: `POINT(${request.location.longitude} ${request.location.latitude})`,
        address: request.address,
        amenities: request.amenities || [],
        images: request.propertyData?.images || [],
        description: request.propertyData?.description,
        status: "available",
        available_from: request.propertyData?.availableFrom || new Date().toISOString(),
        minimum_stay: request.rentalType === "short_term" ? 1 : 30,
      })
      .select()
      .single();

    if (error) throw error;

    // Update session
    await supabase
      .from("agent_sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        metadata: { propertyId: property.id },
      })
      .eq("id", sessionId);

    const message = `✅ *Property Listed Successfully!*\n\n` +
      `Your property has been added to our listings.\n` +
      `Property ID: ${property.id}\n` +
      `Type: ${request.rentalType === "short_term" ? "Short-term" : "Long-term"} rental\n` +
      `Bedrooms: ${property.bedrooms}\n` +
      `Price: ${property.price} RWF/month\n\n` +
      `We'll notify you when potential tenants show interest!`;

    return new Response(
      JSON.stringify({
        success: true,
        propertyId: property.id,
        message,
        sessionId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    throw new Error(`Failed to add property: ${error.message}`);
  }
}

async function handleFindProperty(supabase: any, request: PropertySearchRequest, sessionId: string) {
  try {
    // Personalization: fetch user memories for real_estate domain
    const { data: mems } = await supabase
      .from('user_memories')
      .select('mem_key, mem_value')
      .eq('user_id', request.userId)
      .eq('domain', 'real_estate')
      .order('last_seen', { ascending: false })
      .limit(20);

    // Apply defaults from memory if request fields are missing
    const memMap = new Map<string, any>((mems || []).map((m: any) => [m.mem_key, m.mem_value]));
    if (!request.bedrooms && memMap.get('bedrooms')) request.bedrooms = Number(memMap.get('bedrooms') || 0) || undefined;
    if (!request.minBudget && memMap.get('budget_min')) request.minBudget = Number(memMap.get('budget_min') || 0) || undefined;
    if (!request.maxBudget && memMap.get('budget_max')) request.maxBudget = Number(memMap.get('budget_max') || 0) || undefined;
    if (!request.amenities && memMap.get('amenities')) request.amenities = memMap.get('amenities');
    if (request.furnished === undefined && memMap.get('furnished')) request.furnished = Boolean(memMap.get('furnished'));
    if (request.pets === undefined && memMap.get('pets')) request.pets = Boolean(memMap.get('pets'));
    if (request.accessibility === undefined && memMap.get('accessibility')) request.accessibility = Boolean(memMap.get('accessibility'));
    if (request.parking === undefined && memMap.get('parking')) request.parking = Boolean(memMap.get('parking'));
    if (!request.internetNeeds && memMap.get('internet_needs')) request.internetNeeds = String(memMap.get('internet_needs')) as any;
    if (!request.propertyTypes && memMap.get('property_types')) request.propertyTypes = memMap.get('property_types');

    const radiusKm = 10;
    
    // Search user-listed properties
    const { data: userProperties, error: userError } = await supabase.rpc("search_nearby_properties", {
      p_latitude: request.location.latitude,
      p_longitude: request.location.longitude,
      p_radius_km: radiusKm,
      p_rental_type: request.rentalType,
      p_bedrooms: request.bedrooms,
      p_min_budget: request.minBudget || 0,
      p_max_budget: request.maxBudget || 999999999,
    });

    // Search OpenAI deep research properties
    const { data: researchedProperties, error: researchError } = await supabase.rpc("search_researched_properties", {
      p_latitude: request.location.latitude,
      p_longitude: request.location.longitude,
      p_radius_km: radiusKm,
      p_rental_type: request.rentalType,
      p_bedrooms: request.bedrooms,
      p_min_budget: request.minBudget || 0,
      p_max_budget: request.maxBudget || 999999999,
    });

    // Merge and deduplicate properties
    const allProperties = [
      ...(userProperties || []).map((p: any) => ({ ...p, source_type: 'user_listed' })),
      ...(researchedProperties || []).map((p: any) => ({ ...p, source_type: 'deep_research', owner_id: null }))
    ];

    if (allProperties.length === 0) {
      await supabase
        .from("agent_sessions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", sessionId);

      return new Response(
        JSON.stringify({
          success: false,
          message: "No properties found matching your criteria. Would you like to adjust your search?",
          sessionId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const properties = allProperties;

    // Score and rank properties
    const scoredProperties = properties.map((prop: any) => ({
      ...prop,
      matchScore: calculatePropertyScore(prop, request),
    })).sort((a: any, b: any) => b.matchScore - a.matchScore);

    // Get top 3 properties and create quotes
    const topProperties = scoredProperties.slice(0, 3);
    const quotes = [];

    for (const property of topProperties) {
      // Simulate price negotiation (in production, would contact owners)
      const negotiatedPrice = await simulateNegotiation(property.price, request.maxBudget);

      const vendorName = property.source_type === 'deep_research' 
        ? `${property.source || 'OpenAI Research'}` 
        : (property.owner_name || "Property Owner");

      const { data: quote } = await supabase
        .from("agent_quotes")
        .insert({
          session_id: sessionId,
          vendor_id: property.owner_id || null,
          vendor_type: property.source_type === 'deep_research' ? "researched_property" : "property_owner",
          vendor_name: vendorName,
          offer_data: {
            original_price: property.price,
            negotiated_price: negotiatedPrice,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            location: property.location_address || property.address,
            location_city: property.location_city,
            location_country: property.location_country,
            amenities: property.amenities,
            images: property.images || [],
            distance: property.distance,
            source: property.source || 'user_listed',
            source_type: property.source_type,
            contact_info: property.contact_info,
            currency: property.currency || 'USD'
          },
          status: "pending",
          ranking_score: property.matchScore,
        })
        .select()
        .single();

      quotes.push(quote);
    }

    // Update session
    await supabase
      .from("agent_sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    // Format message
    const message = formatPropertyOptions(topProperties, quotes, mems || []);

    // Store memory summary of this search
    await supabase.from('user_memories').upsert({
      user_id: request.userId,
      domain: 'real_estate',
      memory_type: 'preference',
      mem_key: 'search_prefs',
      mem_value: {
        rentalType: request.rentalType,
        bedrooms: request.bedrooms,
        minBudget: request.minBudget,
        maxBudget: request.maxBudget,
        amenities: request.amenities || [],
        furnished: request.furnished ?? null,
        pets: request.pets ?? null,
        accessibility: request.accessibility ?? null,
        parking: request.parking ?? null,
        internet_needs: request.internetNeeds ?? null,
        property_types: request.propertyTypes || [],
      },
      last_seen: new Date().toISOString(),
    }, { onConflict: 'user_id,domain,mem_key' });

    return new Response(
      JSON.stringify({
        success: true,
        searchId: sessionId,
        options: quotes,
        message,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    throw new Error(`Failed to search properties: ${error.message}`);
  }
}

function calculatePropertyScore(property: any, request: PropertySearchRequest): number {
  let score = 0;

  // Location score (30%)
  if (property.distance < 2) score += 30;
  else if (property.distance < 5) score += 25;
  else if (property.distance < 10) score += 15;
  else score += 5;

  // Price score (30%)
  const priceRatio = property.price / (request.maxBudget || property.price);
  score += (1 - priceRatio) * 30;

  // Amenities score (20%)
  if (request.amenities && request.amenities.length > 0) {
    const matchingAmenities = request.amenities.filter((a: string) =>
      property.amenities.includes(a)
    ).length;
    score += (matchingAmenities / request.amenities.length) * 20;
  } else {
    score += 10;
  }

  // Preference boosts (furnished, pets, parking, accessibility, internet)
  const amens = Array.isArray(property.amenities) ? property.amenities.map((s: string) => String(s).toLowerCase()) : [];
  if (request.furnished !== undefined) {
    if (request.furnished && (amens.includes('furnished') || amens.includes('fully_furnished'))) score += 5;
    if (request.furnished === false && amens.includes('unfurnished')) score += 3;
  }
  if (request.pets && (amens.includes('pet_friendly') || amens.includes('pets_allowed'))) score += 5;
  if (request.parking && (amens.includes('parking') || amens.includes('garage'))) score += 4;
  if (request.accessibility && (amens.includes('accessible') || amens.includes('elevator') || amens.includes('wheelchair_accessible'))) score += 4;
  if (request.internetNeeds === 'high' && (amens.includes('wifi') || amens.includes('fiber'))) score += 4;

  // Size score (10%)
  if (property.bedrooms === request.bedrooms) score += 10;
  else if (property.bedrooms > request.bedrooms) score += 7;

  // Availability score (10%)
  score += 10;

  return Math.round(score);
}

async function simulateNegotiation(originalPrice: number, maxBudget?: number): Promise<number> {
  // Simple negotiation logic
  if (!maxBudget || originalPrice <= maxBudget) {
    return originalPrice;
  }

  // Negotiate 5-10% discount
  const discountPercent = 0.05 + Math.random() * 0.05;
  const negotiatedPrice = Math.round(originalPrice * (1 - discountPercent));

  return Math.max(negotiatedPrice, maxBudget);
}

function formatPropertyOptions(properties: any[], quotes: any[], mems: any[]): string {
  let message = "🏠 *Available Properties:*\n\n";

  // Include memory context if available
  if (Array.isArray(mems) && mems.length) {
    const prefs = mems.filter((m: any) => ['search_prefs','bedrooms','budget_min','budget_max','amenities'].includes(m.mem_key));
    if (prefs.length) {
      message += "📌 Based on your preferences: ";
      message += prefs.map((m: any) => `${m.mem_key}=${JSON.stringify(m.mem_value)}`).join('; ');
      message += "\n\n";
    }
  }

  quotes.forEach((quote: any, index: number) => {
    const offer = quote.offer_data;
    const isResearched = offer.source_type === 'deep_research';
    
    message += `*Option ${index + 1}*${isResearched ? ' 🔍 (AI Research)' : ''}\n`;
    message += `📍 ${offer.location}\n`;
    if (offer.location_city) message += `🏙️ ${offer.location_city}, ${offer.location_country}\n`;
    message += `📏 Distance: ${offer.distance?.toFixed(1)}km\n`;
    message += `🛏️ Bedrooms: ${offer.bedrooms}\n`;
    message += `🚿 Bathrooms: ${offer.bathrooms}\n`;
    message += `\n💰 *Pricing:*\n`;
    message += `  Monthly Rent: ${offer.negotiated_price} ${offer.currency || 'RWF'}`;

    if (offer.negotiated_price < offer.original_price) {
      const discount = ((offer.original_price - offer.negotiated_price) / offer.original_price * 100).toFixed(1);
      message += ` (${discount}% negotiated discount!)`;
    }
    message += `\n  Deposit: ${offer.negotiated_price * 2} ${offer.currency || 'RWF'}\n`;

    if (offer.amenities && offer.amenities.length > 0) {
      message += `\n✨ *Amenities:*\n`;
      offer.amenities.slice(0, 5).forEach((amenity: string) => {
        message += `  • ${amenity}\n`;
      });
    }

    if (isResearched && offer.contact_info) {
      message += `\n📞 Contact: ${offer.contact_info}\n`;
    }

    if (isResearched && offer.source) {
      message += `📰 Source: ${offer.source}\n`;
    }

    message += `─────────────\n\n`;
  });

  message += "_Reply with the option number to get owner's contact details (1, 2, or 3)_";

  return message;
}
