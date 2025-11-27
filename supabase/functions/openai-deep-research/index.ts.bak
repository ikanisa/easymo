// =====================================================
// OPENAI DEEP RESEARCH - Property Scraping Agent
// =====================================================
// Uses OpenAI's o3-deep-research model with Responses API
// + Econfary API for property data
// + SerpAPI for web searches
// Conducts comprehensive real estate market analysis
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://deno.land/x/openai@v4.20.0/mod.ts";
import { logStructuredEvent } from "../_shared/observability.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  timeout: 3600000, // 1 hour timeout for deep research
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function createDeepResearchResponse(params: Record<string, unknown>) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(params),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json?.error?.message ?? "OpenAI responses API error");
  }

  return json;
}

async function createChatCompletion(params: Record<string, unknown>) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(params),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error?.message ?? "OpenAI chat completion error");
  }
  return json;
}

// API Keys
const ECONFARY_API_KEY = "c548f5e85718225f50752750e5be2837035009df30ed57d99b67527c9f200bd7";
const SERPAPI_KEY = Deno.env.get("SERPAPI_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

// =====================================================
// DEEP RESEARCH PROMPT BUILDER
// =====================================================

function buildDeepResearchPrompt(country: string, city?: string): string {
  const location = city ? `${city}, ${country}` : country;
  
  return `Research the current rental property market in ${location}.

OBJECTIVE:
Find comprehensive, up-to-date information about available rental properties (both short-term and long-term rentals) in ${location}.

DO:
- Include specific listings with accurate details: property type, bedrooms, bathrooms, price, location, amenities
- Prioritize reliable, current sources: real estate websites, property portals, classified ads, rental platforms (e.g., Airbnb for short-term)
- Include inline citations and return all source metadata with URLs
- Provide diverse price ranges from budget to luxury properties
- Include exact addresses or neighborhoods when available
- Note any special features, furnishing status, and availability dates

BE:
- Analytical and data-focused, avoid generalities
- Comprehensive in coverage (aim for 10-15+ property listings)
- Precise with numbers (prices, sizes, dates)
- Thorough in documenting sources (direct links to listings preferred)

OUTPUT FORMAT:
Provide a structured report with the following sections:

## Market Overview
Brief summary of the rental market in ${location}: average prices, popular neighborhoods, market trends

## Property Listings

For each property, use this format:

### Property [Number]: [Title]
- **Type**: [apartment/house/villa/studio]
- **Bedrooms**: [number]
- **Bathrooms**: [number]
- **Price**: [amount] [currency] per month
- **Rental Type**: [short_term/long_term]
- **Location**: [exact address or neighborhood]
- **Coordinates**: [latitude, longitude] (if available)
- **Amenities**: [list amenities]
- **Description**: [brief description]
- **Available From**: [date]
- **Source**: [direct URL to listing]
- **Contact**: [contact info if available]

## Summary Table
Create a comparison table with all properties showing: Title, Type, Bedrooms, Price, Location, Source

## Key Findings
- Price ranges observed
- Most common property types
- Popular neighborhoods
- Availability trends

Ensure all prices are in local currency (RWF for Rwanda, EUR for Malta, etc.) and include inline citations throughout.`;
}

// =====================================================
// PROPERTY DATA EXTRACTION & PARSING
// =====================================================

interface ResearchedProperty {
  title: string;
  type: string;
  bedrooms: number;
  bathrooms: number;
  price: number;
  currency: string;
  rentalType: "short_term" | "long_term";
  location: {
    address: string;
    city: string;
    country: string;
    latitude?: number;
    longitude?: number;
  };
  amenities: string[];
  description: string;
  source: string;
  contact?: string;
  availableFrom: string;
  sourceUrl?: string;
}

interface ResearchedJob {
  title: string;
  description: string;
  company?: string;
  location: string;
  category: string;
  jobType: string;
  payMin?: number;
  payMax?: number;
  payType?: string;
  currency?: string;
  contactPhone?: string;
  contactEmail?: string;
  applyUrl?: string;
  sourceUrl?: string;
}

/**
 * Parse deep research output and extract property listings
 */
function parseDeepResearchOutput(outputText: string, annotations: any[]): ResearchedProperty[] {
  const properties: ResearchedProperty[] = [];
  
  // Split by property sections (### Property N:)
  const propertyBlocks = outputText.split(/###\s+Property\s+\d+:/i);
  
  for (let i = 1; i < propertyBlocks.length; i++) {
    const block = propertyBlocks[i];
    
    try {
      // Extract fields using regex
      const titleMatch = block.match(/^([^\n]+)/);
      const typeMatch = block.match(/\*\*Type\*\*:\s*([^\n]+)/i);
      const bedroomsMatch = block.match(/\*\*Bedrooms\*\*:\s*(\d+)/i);
      const bathroomsMatch = block.match(/\*\*Bathrooms\*\*:\s*(\d+)/i);
      const priceMatch = block.match(/\*\*Price\*\*:\s*([\d,]+)\s*([A-Z]+)/i);
      const rentalTypeMatch = block.match(/\*\*Rental Type\*\*:\s*(\w+)/i);
      const locationMatch = block.match(/\*\*Location\*\*:\s*([^\n]+)/i);
      const coordsMatch = block.match(/\*\*Coordinates\*\*:\s*([+-]?\d+\.\d+),\s*([+-]?\d+\.\d+)/i);
      const amenitiesMatch = block.match(/\*\*Amenities\*\*:\s*([^\n]+)/i);
      const descriptionMatch = block.match(/\*\*Description\*\*:\s*([^\n]+)/i);
      const availableFromMatch = block.match(/\*\*Available From\*\*:\s*([^\n]+)/i);
      const sourceMatch = block.match(/\*\*Source\*\*:\s*(https?:\/\/[^\s\n]+)/i);
      const contactMatch = block.match(/\*\*Contact\*\*:\s*([^\n]+)/i);
      
      if (!titleMatch || !typeMatch || !bedroomsMatch || !priceMatch) {
        continue; // Skip incomplete entries
      }
      
      const title = titleMatch[1].trim();
      const type = typeMatch[1].trim().toLowerCase();
      const bedrooms = parseInt(bedroomsMatch[1]);
      const bathrooms = bathroomsMatch ? parseInt(bathroomsMatch[1]) : 1;
      const price = parseFloat(priceMatch[1].replace(/,/g, ''));
      const currency = priceMatch[2];
      const rentalType = rentalTypeMatch?.[1].toLowerCase() === 'short_term' ? 'short_term' : 'long_term';
      const location = locationMatch?.[1].trim() || '';
      const amenities = amenitiesMatch?.[1].split(',').map(a => a.trim()) || [];
      const description = descriptionMatch?.[1].trim() || '';
      const availableFrom = availableFromMatch?.[1].trim() || new Date().toISOString().split('T')[0];
      const sourceUrl = sourceMatch?.[1] || '';
      const contact = contactMatch?.[1].trim();
      
      // Extract coordinates if available
      let latitude: number | undefined;
      let longitude: number | undefined;
      if (coordsMatch) {
        latitude = parseFloat(coordsMatch[1]);
        longitude = parseFloat(coordsMatch[2]);
      }
      
      properties.push({
        title,
        type,
        bedrooms,
        bathrooms,
        price,
        currency,
        rentalType,
        location: {
          address: location,
          city: '', // Will be filled later
          country: '', // Will be filled later
          latitude,
          longitude
        },
        amenities,
        description,
        source: sourceUrl || 'OpenAI Deep Research',
        sourceUrl,
        contact,
        availableFrom
      });
    } catch (error) {
      console.error('Error parsing property block:', error);
      continue;
    }
  }
  
  return properties;
}

// =====================================================
// ECONFARY API INTEGRATION - Enhanced with Contact Validation
// =====================================================

async function fetchEconfaryProperties(country: string, city?: string): Promise<ResearchedProperty[]> {
  try {
    await logStructuredEvent("ECONFARY_API_REQUEST", {
      country,
      city: city || "nationwide"
    });

    const location = city ? `${city}, ${country}` : country;
    
    // Econfary API endpoint
    const response = await fetch("https://api.econfary.com/v1/properties/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ECONFARY_API_KEY}`
      },
      body: JSON.stringify({
        location,
        country,
        city,
        property_types: ["apartment", "house", "villa", "studio"],
        rental_types: ["short_term", "long_term"],
        limit: 100, // Get more properties
        filters: {
          has_contact: true, // Only properties with contact info
          status: "available"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Econfary API error: ${response.statusText}`);
    }

    const data = await response.json();
    const properties: ResearchedProperty[] = [];

    // Parse Econfary response
    if (data.properties && Array.isArray(data.properties)) {
      for (const prop of data.properties) {
        // Validate and normalize contact number
        const rawContact = prop.contact || prop.phone || prop.whatsapp || prop.mobile;
        const normalizedContact = normalizePhoneNumber(rawContact, country);
        
        // Skip properties without valid contact numbers
        if (!normalizedContact) {
          await logStructuredEvent("ECONFARY_SKIP_NO_CONTACT", {
            propertyId: prop.id,
            title: prop.title
          });
          continue;
        }

        // Skip properties without price
        const price = prop.price || prop.monthly_rent || prop.rent;
        if (!price || price <= 0) {
          await logStructuredEvent("ECONFARY_SKIP_NO_PRICE", {
            propertyId: prop.id,
            title: prop.title
          });
          continue;
        }

        properties.push({
          title: prop.title || prop.name,
          type: prop.type || prop.property_type || "apartment",
          bedrooms: prop.bedrooms || 1,
          bathrooms: prop.bathrooms || 1,
          price: price,
          currency: prop.currency || getCurrencyForCountry(country),
          rentalType: prop.rental_type === "short_term" ? "short_term" : "long_term",
          location: {
            address: prop.address || prop.location_address || "",
            city: prop.city || city || "",
            country: prop.country || country,
            latitude: prop.latitude || prop.lat,
            longitude: prop.longitude || prop.lng || prop.lon
          },
          amenities: Array.isArray(prop.amenities) ? prop.amenities : [],
          description: prop.description || prop.details || "",
          source: "Econfary API",
          sourceUrl: prop.url || prop.listing_url || prop.link,
          contact: normalizedContact,
          availableFrom: prop.available_from || prop.availability || new Date().toISOString().split('T')[0]
        });
      }
    }

    await logStructuredEvent("ECONFARY_API_SUCCESS", {
      country,
      city: city || "nationwide",
      propertiesFound: properties.length,
      totalFetched: data.properties?.length || 0
    });

    return properties;

  } catch (error) {
    await logStructuredEvent("ECONFARY_API_ERROR", {
      country,
      city: city || "nationwide",
      error: error.message
    });
    console.error("Econfary API error:", error);
    return [];
  }
}

function extractJsonObject(text: string): any | null {
  if (!text) return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    const fenced = trimmed.match(/```json([\s\S]+?)```/i);
    if (fenced) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch (_) {
        // continue
      }
    }
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      try {
        return JSON.parse(trimmed.slice(first, last + 1));
      } catch (_) {
        return null;
      }
    }
  }
  return null;
}

async function runSourcePropertyResearch(
  country: string,
  sourceUrl: string,
  sourceName: string,
): Promise<ResearchedProperty[]> {
  const prompt = `You are a professional property data researcher. Analyse the website ${sourceName} (${sourceUrl}) and return CURRENT rental listings for ${country}.

REQUIREMENTS:
- Include only legitimate listings with contact numbers.
- Prefer detailed listings with price, bedrooms, bathrooms, and exact locations.
- Provide at least 5 listings when available.

OUTPUT:
Return STRICT JSON with this schema:
{
  "properties": [
    {
      "title": "",
      "type": "apartment|house|villa|studio",
      "bedrooms": 2,
      "bathrooms": 1,
      "price": 500000,
      "currency": "RWF|EUR|USD",
      "rentalType": "short_term|long_term",
      "location": {
        "address": "",
        "city": "",
        "country": "${country}",
        "latitude": number|null,
        "longitude": number|null
      },
      "amenities": ["WiFi","Parking"],
      "description": "",
      "contact": "phone number with country code",
      "availableFrom": "YYYY-MM-DD",
      "sourceUrl": "direct URL to listing"
    }
  ]
}`;

  const response = await createDeepResearchResponse({
    model: "o4-mini-deep-research",
    input: prompt,
    tools: [{ type: "web_search_preview" }],
    max_tool_calls: 25,
    background: false,
  });

  const parsed = extractJsonObject(response.output_text || "");
  const rawList = Array.isArray(parsed?.properties)
    ? parsed?.properties
    : Array.isArray(parsed)
    ? parsed
    : [];

  const normalized: ResearchedProperty[] = [];
  for (const raw of rawList) {
    try {
      const prop: ResearchedProperty = {
        title: raw.title,
        type: raw.type,
        bedrooms: raw.bedrooms,
        bathrooms: raw.bathrooms,
        price: raw.price,
        currency: raw.currency,
        rentalType: raw.rentalType,
        location: {
          address: raw.location?.address || "",
          city: raw.location?.city || "",
          country: raw.location?.country || country,
          latitude: raw.location?.latitude,
          longitude: raw.location?.longitude,
        },
        amenities: raw.amenities || [],
        description: raw.description || "",
        source: sourceName,
        contact: raw.contact,
        availableFrom: raw.availableFrom || new Date().toISOString().split("T")[0],
        sourceUrl: raw.sourceUrl || sourceUrl,
      };

      const validated = validateAndNormalizeProperty(prop, country.slice(0, 2).toUpperCase());
      if (validated) {
        normalized.push(validated);
      }
    } catch (_) {
      continue;
    }
  }

  return normalized;
}

async function runSourceJobResearch(
  country: string,
  sourceUrl: string,
  sourceName: string,
): Promise<ResearchedJob[]> {
  const prompt = `You are an expert recruiter. Gather the latest job postings from ${sourceName} (${sourceUrl}) that are relevant to workers in ${country}.

Return STRICT JSON with the shape:
{
  "jobs": [
    {
      "title": "",
      "company": "",
      "description": "",
      "location": "",
      "category": "delivery|cooking|cleaning|security|construction|data_entry|sales|igaming|healthcare|tutoring|childcare|other",
      "jobType": "gig|part_time|full_time|contract|temporary",
      "payMin": number|null,
      "payMax": number|null,
      "payType": "hourly|daily|weekly|monthly|fixed|commission|negotiable",
      "currency": "RWF|EUR|USD",
      "contactPhone": "phone or WhatsApp with country code",
      "contactEmail": "email if available",
      "applyUrl": "direct link to apply",
      "sourceUrl": "url of the listing"
    }
  ]
}

Respond with JSON only.`;

  const response = await createDeepResearchResponse({
    model: "o4-mini-deep-research",
    input: prompt,
    tools: [{ type: "web_search_preview" }],
    max_tool_calls: 25,
    background: false,
  });

  const parsed = extractJsonObject(response.output_text || "");
  const rawJobs = Array.isArray(parsed?.jobs)
    ? parsed?.jobs
    : Array.isArray(parsed)
    ? parsed
    : [];

  const jobs: ResearchedJob[] = [];
  for (const job of rawJobs) {
    const normalized = normalizeJobResearch(job, country, sourceUrl, sourceName);
    if (normalized) jobs.push(normalized);
  }

  return jobs;
}

// =====================================================
// SERPAPI INTEGRATION - Enhanced Property Extraction
// =====================================================

async function fetchSerpAPIProperties(country: string, city?: string): Promise<ResearchedProperty[]> {
  if (!SERPAPI_KEY) {
    console.warn("SerpAPI key not configured, skipping web search");
    return [];
  }

  try {
    await logStructuredEvent("SERPAPI_REQUEST", {
      country,
      city: city || "nationwide"
    });

    const location = city ? `${city}, ${country}` : country;
    const properties: ResearchedProperty[] = [];
    
    // Multiple search queries to get comprehensive results
    const searchQueries = [
      `rental properties ${location} contact phone whatsapp`,
      `houses for rent ${location} bedrooms price contact`,
      `apartments for rent ${location} furnished price phone`,
      `property rental ${location} available now contact number`,
      `real estate rent ${location} whatsapp contact`
    ];

    for (const query of searchQueries) {
      await logStructuredEvent("SERPAPI_QUERY", {
        country,
        city: city || "nationwide",
        query
      });

      // Get country code for localization
      const countryCode = country === "Rwanda" ? "rw" : 
                         country === "Malta" ? "mt" :
                         country === "Tanzania" ? "tz" :
                         country === "Tanzania" ? "tz" :
                         country === "Burundi" ? "bi" : country === "Congo DRC" ? "cd" : "rw";
      
      const response = await fetch(
        `https://serpapi.com/search?` + new URLSearchParams({
          api_key: SERPAPI_KEY,
          engine: "google",
          q: query,
          num: "30", // Get more results
          gl: countryCode,
          hl: "en"
        })
      );

      if (!response.ok) {
        throw new Error(`SerpAPI error: ${response.statusText}`);
      }

      const data = await response.json();

      // Parse organic results with enhanced extraction
      if (data.organic_results && Array.isArray(data.organic_results)) {
        for (const result of data.organic_results) {
          const extracted = await extractPropertyFromSearchResult(result, country, city);
          if (extracted) {
            properties.push(extracted);
          }
        }
      }

      // Rate limit between queries
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await logStructuredEvent("SERPAPI_SUCCESS", {
      country,
      city: city || "nationwide",
      propertiesFound: properties.length
    });

    return properties;

  } catch (error) {
    await logStructuredEvent("SERPAPI_ERROR", {
      country,
      city: city || "nationwide",
      error: error.message
    });
    console.error("SerpAPI error:", error);
    return [];
  }
}

/**
 * Extract structured property data from search result
 * Uses OpenAI to parse unstructured text into property details
 */
async function extractPropertyFromSearchResult(
  result: any,
  country: string,
  city?: string
): Promise<ResearchedProperty | null> {
  try {
    const text = `${result.title}\n${result.snippet}\n${result.link}`;
    
    // Use OpenAI to extract structured data from search result
    const extractionPrompt = `Extract property rental information from this search result. Return ONLY valid JSON with this exact structure (no markdown, no extra text):

{
  "title": "property title",
  "type": "apartment|house|villa|studio",
  "bedrooms": number,
  "bathrooms": number,
  "price": number,
  "currency": "RWF|EUR|USD|TZS|KES|UGX",
  "rentalType": "short_term|long_term",
  "address": "full address",
  "amenities": ["WiFi", "Parking", etc],
  "description": "brief description",
  "contact": "phone number with country code (WhatsApp preferred)",
  "availableFrom": "YYYY-MM-DD"
}

If contact number is missing, return null for the entire object.
If price is missing, return null for the entire object.
If bedrooms is missing, estimate from context or use 1.

Search result text:
${text}`;

    const extractionResponse = await createChatCompletion({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a property data extraction expert. Extract structured property information from search results. Always respond with valid JSON only."
        },
        {
          role: "user",
          content: extractionPrompt
        }
      ],
      temperature: 0.1,
      max_tokens: 500
    });

    const content = extractionResponse.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    // Parse JSON response
    let jsonContent = content;
    if (content.includes("```json")) {
      jsonContent = content.split("```json")[1].split("```")[0].trim();
    } else if (content.includes("```")) {
      jsonContent = content.split("```")[1].split("```")[0].trim();
    }

    const extracted = JSON.parse(jsonContent);
    
    // Validate required fields
    if (!extracted || 
        !extracted.contact || 
        !extracted.price || 
        extracted.price <= 0) {
      return null;
    }

    // Validate and normalize contact number
    const normalizedContact = normalizePhoneNumber(extracted.contact, country);
    if (!normalizedContact) {
      return null; // Skip properties without valid contact numbers
    }

    return {
      title: extracted.title || result.title,
      type: extracted.type || "apartment",
      bedrooms: Math.max(1, Math.min(20, extracted.bedrooms || 1)),
      bathrooms: Math.max(1, Math.min(10, extracted.bathrooms || 1)),
      price: extracted.price,
      currency: extracted.currency || getCurrencyForCountry(country),
      rentalType: extracted.rentalType === "short_term" ? "short_term" : "long_term",
      location: {
        address: extracted.address || result.link,
        city: city || "",
        country,
        latitude: undefined,
        longitude: undefined
      },
      amenities: Array.isArray(extracted.amenities) ? extracted.amenities : [],
      description: extracted.description || result.snippet || "",
      source: "SerpAPI",
      sourceUrl: result.link,
      contact: normalizedContact,
      availableFrom: extracted.availableFrom || new Date().toISOString().split('T')[0]
    };

  } catch (error) {
    console.error("Error extracting property from search result:", error);
    return null;
  }
}

/**
 * Normalize phone number to international format with country code
 */
function normalizePhoneNumber(phone: string, country: string): string | null {
  if (!phone) return null;

  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Country code mapping
  const countryPrefixes: Record<string, string> = {
    "Rwanda": "+250",
    "Malta": "+356",
    "Tanzania": "+255",
    "Tanzania": "+255",
    "Burundi": "+257",
    "Burundi": "+257"
  };

  const prefix = countryPrefixes[country] || "+250";

  // If already has +, validate length
  if (cleaned.startsWith('+')) {
    if (cleaned.length >= 10) {
      return cleaned;
    }
    return null;
  }

  // If starts with country code without +
  if (cleaned.startsWith(prefix.substring(1))) {
    return '+' + cleaned;
  }

  // If starts with 0, replace with country code
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // Add country code
  const fullNumber = prefix + cleaned;

  // Validate length (typical phone numbers are 10-15 digits)
  if (fullNumber.length < 10 || fullNumber.length > 17) {
    return null;
  }

  return fullNumber;
}

/**
 * Get currency code for country
 */
function getCurrencyForCountry(country: string): string {
  const currencyMap: Record<string, string> = {
    "Rwanda": "RWF",
    "Malta": "EUR",
    "Tanzania": "TZS",
    "Tanzania": "TZS",
    "Burundi": "BIF",
    "Burundi": "BIF"
  };
  return currencyMap[country] || "USD";
}

async function geocodeAddress(address: string, city: string, country: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    // Use simple geocoding with OpenAI chat (not deep research)
    const prompt = `Given the address "${address}, ${city}, ${country}", provide the most accurate latitude and longitude coordinates. Respond ONLY with JSON: {"latitude": -1.234, "longitude": 30.123}`;
    
    const response = await createChatCompletion({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 100
    });

    const content = response.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    const coords = JSON.parse(content);
    if (coords.latitude && coords.longitude) {
      return {
        latitude: Number(coords.latitude),
        longitude: Number(coords.longitude)
      };
    }
  } catch (error) {
    console.error("Geocoding error:", error);
  }
  return null;
}

// =====================================================
// DEEP RESEARCH EXECUTION (Using Responses API)
// =====================================================

async function executeDeepResearch(
  country: { code: string; name: string }, 
  cities?: string[]
): Promise<ResearchedProperty[]> {
  const allProperties: ResearchedProperty[] = [];
  const targetCities = cities && cities.length > 0 ? cities : [undefined];

  for (const city of targetCities) {
    try {
      await logStructuredEvent("DEEP_RESEARCH_START", {
        country: country.name,
        city: city || "nationwide",
        sources: ["OpenAI Deep Research", "Econfary API", "SerpAPI"]
      });

      // SOURCE 1: Econfary API
      const econfaryProperties = await fetchEconfaryProperties(country.name, city);
      
      // SOURCE 2: SerpAPI Web Search
      const serpAPIProperties = await fetchSerpAPIProperties(country.name, city);

      // SOURCE 3: OpenAI Deep Research
      const prompt = buildDeepResearchPrompt(country.name, city);
      
      const response = await createDeepResearchResponse({
        model: "o4-mini-deep-research",
        input: prompt,
        background: false,
        tools: [
          {
            type: "web_search_preview"
          }
        ],
        max_tool_calls: 50 
      });

      await logStructuredEvent("DEEP_RESEARCH_RESPONSE", {
        country: country.name,
        city: city || "nationwide",
        outputLength: response.output_text.length,
        toolCallsUsed: response.output?.filter((o: any) => 
          o.type === 'web_search_call' || o.type === 'code_interpreter_call'
        ).length || 0
      });

      const openAIProperties = parseDeepResearchOutput(
        response.output_text, 
        response.output || []
      );

      // MERGE ALL SOURCES
      const allSources = [
        ...econfaryProperties.map(p => ({ ...p, source: "Econfary API" })),
        ...serpAPIProperties.map(p => ({ ...p, source: "SerpAPI" })),
        ...openAIProperties.map(p => ({ ...p, source: "OpenAI Deep Research" }))
      ];

      // Fill in country/city information and validate
      for (const prop of allSources) {
        prop.location.country = country.name;
        prop.location.city = city || prop.location.city || prop.location.address.split(',')[0] || '';
        
        const validated = validateAndNormalizeProperty(prop, country.code);
        if (validated) {
          // Geocode if missing coordinates
          if (!validated.location.latitude || !validated.location.longitude) {
            const coords = await geocodeAddress(
              validated.location.address,
              validated.location.city,
              validated.location.country
            );
            if (coords) {
              validated.location.latitude = coords.latitude;
              validated.location.longitude = coords.longitude;
            }
          }
          
          allProperties.push(validated);
        }
      }

      await logStructuredEvent("DEEP_RESEARCH_SUCCESS", {
        country: country.name,
        city: city || "nationwide",
        econfaryCount: econfaryProperties.length,
        serpAPICount: serpAPIProperties.length,
        openAICount: openAIProperties.length,
        totalValidated: allProperties.length
      });

      // Rate limiting - wait between cities
      if (targetCities.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

    } catch (error) {
      await logStructuredEvent("DEEP_RESEARCH_ERROR", {
        country: country.name,
        city: city || "nationwide",
        error: error.message
      });
      console.error(`Deep research error for ${city || country.name}:`, error);
    }
  }

  return allProperties;
}

/**
 * Validate and normalize extracted property data
 */
function validateAndNormalizeProperty(
  prop: ResearchedProperty, 
  countryCode: string
): ResearchedProperty | null {
  try {
    if (!prop.title || !prop.type || !prop.bedrooms || !prop.price) {
      return null;
    }

    const currencyMap: Record<string, string> = {
      RW: "RWF", MT: "EUR", TZ: "TZS", KE: "KES", UG: "UGX"
    };
    const currency = prop.currency || currencyMap[countryCode] || "USD";

    // Validate price is reasonable
    if (prop.price <= 0 || prop.price > 100000000) {
      return null;
    }

    return {
      ...prop,
      title: String(prop.title).slice(0, 200),
      type: String(prop.type).toLowerCase(),
      bedrooms: Math.max(0, Math.min(20, Number(prop.bedrooms) || 1)),
      bathrooms: Math.max(0, Math.min(10, Number(prop.bathrooms) || 1)),
      price: Number(prop.price),
      currency,
      location: {
        address: String(prop.location.address || "").slice(0, 300),
        city: String(prop.location.city || "").slice(0, 100),
        country: String(prop.location.country || "").slice(0, 100),
        latitude: prop.location.latitude,
        longitude: prop.location.longitude
      },
      amenities: Array.isArray(prop.amenities) ? prop.amenities.slice(0, 20) : [],
      description: String(prop.description || "").slice(0, 2000),
      source: String(prop.source || "OpenAI Deep Research").slice(0, 200),
      availableFrom: prop.availableFrom || new Date().toISOString().split('T')[0]
    };
  } catch (error) {
    console.error("Property validation error:", error);
    return null;
  }
}

async function insertResearchedProperties(properties: ResearchedProperty[], researchSessionId: string) {
  const insertedCount = { success: 0, failed: 0, duplicate: 0, noContact: 0 };

  for (const prop of properties) {
    try {
      // CRITICAL: Validate contact number exists
      if (!prop.contact || prop.contact.length < 10) {
        insertedCount.noContact++;
        await logStructuredEvent("PROPERTY_SKIP_NO_CONTACT", {
          title: prop.title,
          source: prop.source
        });
        continue;
      }

      const { data: existing } = await supabase
        .from("researched_properties")
        .select("id")
        .eq("title", prop.title)
        .eq("location_address", prop.location.address)
        .maybeSingle();

      if (existing) {
        insertedCount.duplicate++;
        continue;
      }

      let locationPoint = null;
      if (prop.location.latitude && prop.location.longitude) {
        locationPoint = `POINT(${prop.location.longitude} ${prop.location.latitude})`;
      }

      const { error } = await supabase
        .from("researched_properties")
        .insert({
          research_session_id: researchSessionId,
          title: prop.title,
          property_type: prop.type,
          bedrooms: prop.bedrooms,
          bathrooms: prop.bathrooms,
          price: prop.price,
          currency: prop.currency,
          rental_type: prop.rentalType,
          location: locationPoint,
          location_address: prop.location.address,
          location_city: prop.location.city,
          location_country: prop.location.country,
          amenities: prop.amenities,
          description: prop.description,
          source: prop.source,
          source_url: prop.sourceUrl || null,
          contact_info: prop.contact, // REQUIRED FIELD
          available_from: prop.availableFrom,
          status: "active",
          scraped_at: new Date().toISOString()
        });

      if (error) {
        console.error("Insert error:", error);
        insertedCount.failed++;
      } else {
        insertedCount.success++;
      }
    } catch (error) {
      console.error("Property insertion error:", error);
      insertedCount.failed++;
    }
  }

  return insertedCount;
}

function normalizeJobResearch(
  job: any,
  country: string,
  sourceUrl: string,
  sourceName: string,
): ResearchedJob | null {
  if (!job?.title || !job?.description) return null;

  const jobType = normalizeJobType(job.jobType);
  const category = normalizeJobCategory(job.category);
  const payType = normalizePayType(job.payType);
  const currency = job.currency || (country === "MT" ? "EUR" : "RWF");

  return {
    title: String(job.title).trim().slice(0, 200),
    description: String(job.description).trim(),
    company: job.company || sourceName,
    location: job.location || country,
    category,
    jobType,
    payMin: job.payMin ? Number(job.payMin) : undefined,
    payMax: job.payMax ? Number(job.payMax) : undefined,
    payType,
    currency,
    contactPhone: job.contactPhone || job.contact || undefined,
    contactEmail: job.contactEmail || undefined,
    applyUrl: job.applyUrl || job.sourceUrl || sourceUrl,
    sourceUrl: job.sourceUrl || sourceUrl,
  };
}

function normalizeJobType(type?: string) {
  const normalized = (type || "").toLowerCase();
  const allowed = ["gig", "part_time", "full_time", "contract", "temporary"];
  return allowed.includes(normalized) ? normalized : "gig";
}

function normalizeJobCategory(category?: string) {
  const normalized = (category || "").toLowerCase();
  const allowed = [
    "delivery",
    "cooking",
    "cleaning",
    "security",
    "construction",
    "data_entry",
    "sales",
    "igaming",
    "healthcare",
    "tutoring",
    "childcare",
    "other",
  ];
  return allowed.includes(normalized) ? normalized : "other";
}

function normalizePayType(payType?: string) {
  const normalized = (payType || "").toLowerCase();
  const allowed = [
    "hourly",
    "daily",
    "weekly",
    "monthly",
    "fixed",
    "commission",
    "negotiable",
  ];
  return allowed.includes(normalized) ? normalized : "negotiable";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body = await req.json();
    const action = body.action ?? "scrape";
    const requestType = (body.type ?? "properties") as "jobs" | "properties";
    const testMode = Boolean(body.testMode);
    const sourceUrl: string | undefined = body.source_url;
    const sourceName: string | undefined = body.source_name;
    const fast: boolean = Boolean(body.fast);
    const explicitCountry: string | undefined = body.country;
    const targetCountries = body.countries as string[] | undefined;

    await logStructuredEvent("DEEP_RESEARCH_REQUEST", {
      action,
      requestType,
      targetCountries: targetCountries || explicitCountry || "all",
      testMode
    });

    // Source-specific scrape mode (used by source-url-scraper)
    if (action === "source_scrape" && sourceUrl) {
      if (requestType === "jobs") {
        let jobs;
        if (fast) {
          // Fast mode: avoid heavy deep-research; use chat-based extraction fallback (lighter) or empty
          jobs = await runSourceJobResearch(
            explicitCountry ?? "RW",
            sourceUrl,
            sourceName ?? sourceUrl,
          );
        } else {
          jobs = await runSourceJobResearch(
            explicitCountry ?? "RW",
            sourceUrl,
            sourceName ?? sourceUrl,
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            listingType: "jobs",
            listings: jobs,
            source: sourceUrl,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      let properties;
      if (fast) {
        // Fast mode: use SerpAPI-only results to avoid long deep-research calls
        properties = await fetchSerpAPIProperties(explicitCountry ?? "RW");
      } else {
        properties = await runSourcePropertyResearch(
          explicitCountry ?? "RW",
          sourceUrl,
          sourceName ?? sourceUrl,
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          listingType: "properties",
          listings: properties,
          source: sourceUrl,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: session, error: sessionError } = await supabase
      .from("research_sessions")
      .insert({
        status: "running",
        started_at: new Date().toISOString(),
        metadata: { action, targetCountries, testMode }
      })
      .select("id")
      .single();

    if (sessionError) throw sessionError;

    let countriesQuery = supabase.from("countries")
      .select("code, name")
      .eq("is_active", true);

    if (targetCountries && Array.isArray(targetCountries) && targetCountries.length > 0) {
      countriesQuery = countriesQuery.in("code", targetCountries);
    } else if (explicitCountry) {
      countriesQuery = countriesQuery.eq("code", explicitCountry);
    }

    const { data: countries, error: countriesError } = await countriesQuery;

    if (countriesError) throw countriesError;
    if (!countries || countries.length === 0) {
      throw new Error("No active countries found");
    }

    await logStructuredEvent("DEEP_RESEARCH_COUNTRIES", {
      sessionId: session.id,
      countries: countries.map(c => c.name).join(", "),
      count: countries.length
    });

    const citiesMap: Record<string, string[]> = {
      RW: ["Kigali", "Gisenyi", "Rubavu"],
      MT: ["Valletta", "Sliema", "St. Julian's", "Gzira"],
      TZ: ["Dar es Salaam", "Arusha"],
      KE: ["Nairobi", "Mombasa"],
      UG: ["Kampala", "Entebbe"]
    };

    let allProperties: ResearchedProperty[] = [];

    for (const country of countries) {
      const cities = testMode ? [citiesMap[country.code]?.[0]] : citiesMap[country.code];
      const properties = await executeDeepResearch(country, cities);
      allProperties = [...allProperties, ...properties];

      if (testMode) break;
    }

    const insertStats = await insertResearchedProperties(allProperties, session.id);

    await supabase
      .from("research_sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        properties_found: allProperties.length,
        properties_inserted: insertStats.success,
        properties_failed: insertStats.failed,
        properties_duplicate: insertStats.duplicate,
        duration_ms: Date.now() - startTime
      })
      .eq("id", session.id);

    await logStructuredEvent("DEEP_RESEARCH_COMPLETE", {
      sessionId: session.id,
      duration: Date.now() - startTime,
      propertiesFound: allProperties.length,
      inserted: insertStats.success,
      duplicates: insertStats.duplicate,
      failed: insertStats.failed
    });

    return new Response(
      JSON.stringify({
        success: true,
        sessionId: session.id,
        listingType: "properties",
        listings: allProperties,
        statistics: {
          countriesSearched: countries.length,
          propertiesFound: allProperties.length,
          propertiesInserted: insertStats.success,
          duplicates: insertStats.duplicate,
          failed: insertStats.failed,
          durationMs: Date.now() - startTime
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    await logStructuredEvent("DEEP_RESEARCH_FATAL_ERROR", {
      error: error.message,
      duration: Date.now() - startTime
    });

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
