/**
 * Gemini-Backed Tools for EasyMO Agents
 * 
 * Specialized tools leveraging Gemini's Google ecosystem integration:
 * - Maps & Places API integration
 * - Document parsing and OCR
 * - Data normalization and enrichment
 * - Cross-checking and validation
 * 
 * All tools remain grounded in EasyMO data - Gemini is a processing engine, not a data source.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js";

import { GeminiProvider } from "./llm-provider-gemini.ts";
import { logError, logStructuredEvent, recordMetric } from "./observability.ts";

export interface VendorPayload {
  rawText?: string;
  imageUrl?: string;
  categories?: string[];
}

export interface NormalizedVendor {
  vendor_name: string;
  categories: string[];
  description?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  opening_hours?: string;
  contact_info?: {
    phone?: string;
    email?: string;
    whatsapp?: string;
  };
}

export interface GeoSearchResult {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  place_id?: string;
  types?: string[];
  distance_km?: number;
}

/**
 * Normalize vendor payload using Gemini
 * Extracts structured data from messy text/images
 */
export async function normalizeVendorPayload(
  payload: VendorPayload,
  correlationId?: string
): Promise<NormalizedVendor> {
  const startTime = Date.now();

  try {
    logStructuredEvent("GEMINI_NORMALIZE_VENDOR_START", {
      hasText: !!payload.rawText,
      hasImage: !!payload.imageUrl,
      correlationId,
    });

    const gemini = new GeminiProvider(undefined, correlationId);

    let extractedText = payload.rawText || '';

    // If image provided, extract text first
    if (payload.imageUrl) {
      extractedText = await gemini.analyzeImage(
        payload.imageUrl,
        `Extract all business information from this image including:
- Business name
- Type of business / categories
- Address
- Contact information (phone, email, WhatsApp)
- Opening hours
Format as structured text.`
      );
    }

    // Now use Gemini to structure the data
    const structurePrompt = `Given this business information, extract and normalize it into a structured format:

${extractedText}

Extract:
1. vendor_name (official business name)
2. categories (array of business types: e.g., ['hardware', 'construction', 'retail'])
3. description (brief business description)
4. address (physical location)
5. contact_info (phone, email, whatsapp if available)
6. opening_hours (if mentioned)

Respond ONLY with valid JSON matching this exact structure:
{
  "vendor_name": "string",
  "categories": ["string"],
  "description": "string",
  "address": "string",
  "opening_hours": "string",
  "contact_info": {
    "phone": "string",
    "email": "string",
    "whatsapp": "string"
  }
}`;

    const response = await gemini.chat({
      model: 'gemini-2.5-flash', // Fast structured extraction
      messages: [{ role: 'user', content: structurePrompt }],
      temperature: 0.3, // Low temperature for structured extraction
    });

    // Parse JSON response
    let normalized: NormalizedVendor;
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      normalized = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      logError("gemini_normalize_json_parse_failed", parseError, {
        response: response.content.substring(0, 200),
        correlationId,
      });
      throw new Error("Failed to parse normalized vendor data");
    }

    // Geocode address if present
    if (normalized.address) {
      try {
        const geoResult = await geocodeAddress(normalized.address, correlationId);
        if (geoResult) {
          normalized.latitude = geoResult.latitude;
          normalized.longitude = geoResult.longitude;
        }
      } catch (geoError) {
        // Non-fatal, just log
        logError("geocode_vendor_address_failed", geoError, {
          address: normalized.address,
          correlationId,
        });
      }
    }

    const duration = Date.now() - startTime;

    logStructuredEvent("GEMINI_NORMALIZE_VENDOR_COMPLETE", {
      vendorName: normalized.vendor_name,
      categories: normalized.categories,
      hasGeocode: !!(normalized.latitude && normalized.longitude),
      durationMs: duration,
      correlationId,
    });

    recordMetric("gemini.normalize_vendor.success", 1, {
      duration_ms: duration,
    });

    return normalized;

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logError("gemini_normalize_vendor_failed", error, {
      durationMs: duration,
      correlationId,
    });

    recordMetric("gemini.normalize_vendor.error", 1);

    throw error;
  }
}

/**
 * Geocode an address using Gemini (can integrate with Google Maps)
 * For now, returns null - integrate with actual geocoding API
 */
async function geocodeAddress(
  address: string,
  correlationId?: string
): Promise<GeoSearchResult | null> {
  // TODO: Integrate with Google Maps Geocoding API
  // This would use the GOOGLE_MAPS_API_KEY
  logStructuredEvent("GEOCODE_ADDRESS", {
    address,
    correlationId,
  });

  return null;
}

/**
 * Find vendors nearby using Google Maps/Places
 * Filters results to only EasyMO-registered vendors
 */
export async function findVendorsNearby(
  query: string,
  latitude: number,
  longitude: number,
  radiusKm = 5,
  vertical?: string,
  correlationId?: string
): Promise<any[]> {
  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    logStructuredEvent("GEMINI_FIND_VENDORS_START", {
      query,
      latitude,
      longitude,
      radiusKm,
      vertical,
      correlationId,
    });

    // Query EasyMO vendors database with geographic filter
    const { data: vendors, error } = await supabase.rpc("vendors_nearby", {
      p_vertical: vertical || null,
      p_category: null,
      p_latitude: latitude,
      p_longitude: longitude,
      p_radius_km: radiusKm,
      p_limit: 20,
    });

    if (error) throw error;

    const duration = Date.now() - startTime;

    logStructuredEvent("GEMINI_FIND_VENDORS_COMPLETE", {
      vendorsFound: vendors?.length || 0,
      durationMs: duration,
      correlationId,
    });

    recordMetric("gemini.find_vendors.success", 1, {
      vendors_found: vendors?.length || 0,
      duration_ms: duration,
    });

    return vendors || [];

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logError("gemini_find_vendors_failed", error, {
      durationMs: duration,
      correlationId,
    });

    recordMetric("gemini.find_vendors.error", 1);

    throw error;
  }
}

/**
 * Parse and structure document/image (menus, property listings, job postings, etc.)
 */
export async function parseDocument(
  imageUrl: string,
  documentType: 'menu' | 'property' | 'job_posting' | 'farming_doc',
  correlationId?: string
): Promise<any> {
  const startTime = Date.now();

  try {
    logStructuredEvent("GEMINI_PARSE_DOCUMENT_START", {
      documentType,
      imageUrl: imageUrl.substring(0, 100),
      correlationId,
    });

    const gemini = new GeminiProvider(undefined, correlationId);

    const prompts: Record<typeof documentType, string> = {
      menu: `Extract all menu items from this image. For each item provide:
- name (dish name)
- price (numerical value and currency)
- description (if available)
- category (appetizer, main, dessert, drinks, etc.)
- dietary_tags (vegetarian, vegan, gluten-free, etc.)

Return as JSON array.`,

      property: `Extract property listing information:
- title
- price (rental/sale price and currency)
- location (address, neighborhood)
- bedrooms, bathrooms
- area_sqm
- property_type (apartment, house, land, etc.)
- amenities (array)
- description

Return as JSON object.`,

      job_posting: `Extract job posting details:
- job_title
- company
- location
- employment_type (full-time, part-time, contract)
- salary_range
- requirements (array)
- responsibilities (array)
- application_deadline

Return as JSON object.`,

      farming_doc: `Extract farming information:
- topic (crop type, disease, practice)
- recommendations (array)
- timing (planting/harvest windows)
- inputs_needed (seeds, fertilizers, etc.)
- expected_yield

Return as JSON object.`,
    };

    const result = await gemini.analyzeImage(imageUrl, prompts[documentType]);

    // Parse JSON
    let parsed;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      logError("gemini_parse_document_json_failed", parseError, {
        documentType,
        response: result.substring(0, 200),
        correlationId,
      });
      throw new Error("Failed to parse document structure");
    }

    const duration = Date.now() - startTime;

    logStructuredEvent("GEMINI_PARSE_DOCUMENT_COMPLETE", {
      documentType,
      durationMs: duration,
      correlationId,
    });

    recordMetric("gemini.parse_document.success", 1, {
      document_type: documentType,
      duration_ms: duration,
    });

    return parsed;

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logError("gemini_parse_document_failed", error, {
      documentType,
      durationMs: duration,
      correlationId,
    });

    recordMetric("gemini.parse_document.error", 1, {
      document_type: documentType,
    });

    throw error;
  }
}

/**
 * Cross-check and validate critical information
 * Used for insurance quotes, legal summaries, compliance checks
 */
export async function crossCheckResponse(
  draftResponse: string,
  contextData: Record<string, unknown>,
  validationRules: string[],
  correlationId?: string
): Promise<{ isValid: boolean; issues?: string[]; confidence: number }> {
  const startTime = Date.now();

  try {
    logStructuredEvent("GEMINI_CROSS_CHECK_START", {
      responseLength: draftResponse.length,
      rulesCount: validationRules.length,
      correlationId,
    });

    const gemini = new GeminiProvider(undefined, correlationId);

    const prompt = `You are a fact-checker for EasyMO customer service responses.

DRAFT RESPONSE:
${draftResponse}

CONTEXT DATA:
${JSON.stringify(contextData, null, 2)}

VALIDATION RULES:
${validationRules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}

Check if the draft response:
1. Contains any factual errors based on the context data
2. Violates any of the validation rules
3. Makes unsupported claims or promises

Respond with JSON:
{
  "isValid": boolean,
  "issues": ["string array of specific issues found, if any"],
  "confidence": number (0-100, your confidence in this assessment)
}`;

    const result = await gemini.chat({
      model: 'gemini-2.5-flash', // Fast validation
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2, // Low temperature for validation
    });

    // Parse JSON
    let validation;
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      validation = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      logError("gemini_cross_check_json_failed", parseError, {
        response: result.content.substring(0, 200),
        correlationId,
      });
      // Default to invalid if we can't parse
      validation = { isValid: false, issues: ["Validation parse failed"], confidence: 0 };
    }

    const duration = Date.now() - startTime;

    logStructuredEvent("GEMINI_CROSS_CHECK_COMPLETE", {
      isValid: validation.isValid,
      issuesCount: validation.issues?.length || 0,
      confidence: validation.confidence,
      durationMs: duration,
      correlationId,
    });

    recordMetric("gemini.cross_check.success", 1, {
      is_valid: validation.isValid ? 1 : 0,
      duration_ms: duration,
    });

    return validation;

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logError("gemini_cross_check_failed", error, {
      durationMs: duration,
      correlationId,
    });

    recordMetric("gemini.cross_check.error", 1);

    // Return conservative result on error
    return {
      isValid: false,
      issues: ["Validation system error"],
      confidence: 0,
    };
  }
}
