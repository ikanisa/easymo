/**
 * Marketplace Utility Functions
 *
 * Location parsing, formatting, and notification utilities.
 *
 * @see docs/GROUND_RULES.md for observability requirements
 */

import { logStructuredEvent } from "../../_shared/observability.ts";

// =====================================================
// CONSTANTS
// =====================================================

/**
 * Rwanda phone number validation pattern
 * Matches: +250XXXXXXXXX, 250XXXXXXXXX, 07XXXXXXXX
 * Rwanda country code is 250, local numbers start with 07
 */
const RWANDA_PHONE_PATTERN = /^(250|07)\d{8,9}$/;

// =====================================================
// TYPES
// =====================================================

export interface Location {
  lat: number;
  lng: number;
  text?: string;
}

// =====================================================
// LOCATION UTILITIES
// =====================================================

/**
 * Parse location from WhatsApp location message
 */
export function parseWhatsAppLocation(locationMsg: {
  latitude?: number;
  longitude?: number;
  name?: string;
  address?: string;
}): Location | null {
  if (locationMsg.latitude && locationMsg.longitude) {
    return {
      lat: locationMsg.latitude,
      lng: locationMsg.longitude,
      text: locationMsg.name || locationMsg.address,
    };
  }
  return null;
}

/**
 * Parse location from text (city/area names in Rwanda)
 */
export function parseLocationFromText(text: string): Location | null {
  const textLower = text.toLowerCase().trim();

  // Known locations in Rwanda with approximate coordinates
  const rwandaLocations: Record<string, { lat: number; lng: number }> = {
    // Kigali districts
    kigali: { lat: -1.9403, lng: 30.0588 },
    nyarugenge: { lat: -1.9443, lng: 30.0611 },
    gasabo: { lat: -1.9106, lng: 30.1044 },
    kicukiro: { lat: -1.9897, lng: 30.1128 },
    // Kigali sectors
    kimironko: { lat: -1.9267, lng: 30.1056 },
    nyamirambo: { lat: -1.9736, lng: 30.0411 },
    remera: { lat: -1.9489, lng: 30.1083 },
    gisozi: { lat: -1.9178, lng: 30.0689 },
    kimihurura: { lat: -1.9367, lng: 30.0883 },
    kacyiru: { lat: -1.9281, lng: 30.0822 },
    gikondo: { lat: -1.9669, lng: 30.0758 },
    kanombe: { lat: -1.9672, lng: 30.1347 },
    // Other cities
    butare: { lat: -2.5967, lng: 29.7389 },
    huye: { lat: -2.5967, lng: 29.7389 },
    gitarama: { lat: -2.0728, lng: 29.7544 },
    muhanga: { lat: -2.0728, lng: 29.7544 },
    ruhengeri: { lat: -1.5, lng: 29.6333 },
    musanze: { lat: -1.5, lng: 29.6333 },
    gisenyi: { lat: -1.7028, lng: 29.2561 },
    rubavu: { lat: -1.7028, lng: 29.2561 },
    kibuye: { lat: -2.0608, lng: 29.3492 },
    karongi: { lat: -2.0608, lng: 29.3492 },
    byumba: { lat: -1.5758, lng: 30.0672 },
    gicumbi: { lat: -1.5758, lng: 30.0672 },
    rwamagana: { lat: -1.9494, lng: 30.4344 },
    kayonza: { lat: -1.8583, lng: 30.5833 },
    kibungo: { lat: -2.1589, lng: 30.5369 },
    ngoma: { lat: -2.1589, lng: 30.5369 },
    nyagatare: { lat: -1.2931, lng: 30.3272 },
    rusizi: { lat: -2.4797, lng: 28.9083 },
  };

  // Try to match known locations
  for (const [name, coords] of Object.entries(rwandaLocations)) {
    if (textLower.includes(name)) {
      return {
        lat: coords.lat,
        lng: coords.lng,
        text: name.charAt(0).toUpperCase() + name.slice(1),
      };
    }
  }

  return null;
}

/**
 * Calculate distance between two points (Haversine formula)
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// =====================================================
// FORMATTING UTILITIES
// =====================================================

/**
 * Format price with currency
 */
export function formatPrice(
  price: number,
  currency: string = "RWF",
): string {
  if (currency === "RWF") {
    return `${price.toLocaleString()} RWF`;
  }
  return `${price.toLocaleString()} ${currency}`;
}

/**
 * Format distance
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }
  return `${distanceKm.toFixed(1)}km`;
}

/**
 * Format rating as stars
 */
export function formatRating(rating: number): string {
  const fullStars = Math.floor(rating);
  const halfStar = rating - fullStars >= 0.5;
  return "⭐".repeat(fullStars) + (halfStar ? "✨" : "");
}

/**
 * Format listing for WhatsApp message
 */
export function formatListing(listing: {
  title: string;
  product_name?: string;
  price?: number;
  currency?: string;
  location_text?: string;
  description?: string;
  seller_phone?: string;
  distance_km?: number;
}): string {
  let formatted = `🛍️ *${listing.title}*\n`;

  if (listing.price) {
    formatted += `💰 ${formatPrice(listing.price, listing.currency)}\n`;
  }

  if (listing.location_text) {
    formatted += `📍 ${listing.location_text}`;
    if (listing.distance_km) {
      formatted += ` (${formatDistance(listing.distance_km)} away)`;
    }
    formatted += "\n";
  }

  if (listing.description) {
    formatted += `\n${listing.description}\n`;
  }

  return formatted;
}

/**
 * Format business for WhatsApp message
 */
export function formatBusiness(business: {
  name: string;
  category: string;
  city?: string;
  address?: string;
  phone?: string;
  rating?: number;
  distance_km?: number;
}): string {
  let formatted = `🏪 *${business.name}*\n`;
  formatted += `📂 ${business.category}\n`;

  if (business.city || business.address) {
    formatted += `📍 ${business.address || business.city}`;
    if (business.distance_km) {
      formatted += ` (${formatDistance(business.distance_km)} away)`;
    }
    formatted += "\n";
  }

  if (business.rating) {
    formatted += `${formatRating(business.rating)} ${business.rating.toFixed(1)}\n`;
  }

  if (business.phone) {
    formatted += `📞 ${business.phone}\n`;
  }

  return formatted;
}

// =====================================================
// MESSAGE EXTRACTION
// =====================================================

/**
 * Extract WhatsApp message from webhook payload
 */
export function extractWhatsAppMessage(payload: unknown): {
  from: string;
  body: string;
  type: string;
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  image?: { id?: string; link?: string; url?: string };
  audio?: { id: string; mime_type: string };
  interactive?: { list_reply?: { id: string; title: string }; button_reply?: { id: string; title: string } };
  messageId?: string;
} | null {
  try {
    const p = payload as Record<string, unknown>;
    
    // Standard WhatsApp webhook format
    if (p?.entry) {
      const entry = p.entry as Array<{ changes?: Array<{ value?: { messages?: Array<Record<string, unknown>> } }> }>;
      const msg = entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (msg) {
        return {
          from: msg.from as string,
          body:
            (typeof (msg.text as Record<string, unknown>)?.body === 'string' ? (msg.text as Record<string, unknown>)?.body : null) ||
            ((msg.interactive as Record<string, unknown>)?.button_reply as Record<string, unknown>)?.title as string ||
            ((msg.interactive as Record<string, unknown>)?.list_reply as Record<string, unknown>)?.title as string ||
            "",
          type: msg.type as string,
          location: msg.location as { latitude: number; longitude: number; name?: string; address?: string },
          image: msg.image as { id?: string; link?: string; url?: string },
          audio: msg.audio as { id: string; mime_type: string } | undefined,
          interactive: msg.interactive as { list_reply?: { id: string; title: string }; button_reply?: { id: string; title: string } },
          messageId: msg.id as string,
        };
      }
    }

    // Simplified format
    if (p?.from && p?.body) {
      return {
        from: p.from as string,
        body: p.body as string,
        type: (p.type as string) || "text",
        location: p.location as { latitude: number; longitude: number; name?: string; address?: string },
        messageId: p.id as string,
      };
    }

    return null;
  } catch {
    return null;
  }
}

// =====================================================
// NOTIFICATION UTILITIES
// =====================================================

/**
 * Build notification message for matching buyers
 */
export function buildBuyerNotification(listing: {
  title: string;
  price?: number;
  currency?: string;
  location_text?: string;
  distance_km?: number;
}): string {
  let message = `🔔 *New Match Found!*\n\n`;
  message += `We found something you might be interested in:\n\n`;
  message += formatListing(listing);
  message += `\nReply *yes* to get the seller's contact, or *no* to skip.`;
  return message;
}

/**
 * Build notification message for sellers
 */
export function buildSellerNotification(buyer: {
  lookingFor: string;
  location_text?: string;
}): string {
  let message = `🔔 *Someone is interested!*\n\n`;
  message += `A buyer is looking for: *${buyer.lookingFor}*\n`;
  if (buyer.location_text) {
    message += `Location: ${buyer.location_text}\n`;
  }
  message += `\nReply *contact* to share your details with them.`;
  return message;
}

// =====================================================
// VALIDATION UTILITIES
// =====================================================

/**
 * Parse price from text
 */
export function parsePriceFromText(text: string): number | null {
  // Remove currency symbols and common words
  const cleaned = text
    .toLowerCase()
    .replace(/rwf|frw|francs?|money|price|cost/gi, "")
    .replace(/,/g, "")
    .trim();

  // Try to extract number
  const match = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (match) {
    return parseFloat(match[1]);
  }

  return null;
}

/**
 * Validate phone number format
 */
export function isValidPhone(phone: string): boolean {
  // Rwanda phone formats: +250... or 07...
  const cleaned = phone.replace(/\D/g, "");
  return RWANDA_PHONE_PATTERN.test(cleaned);
}

/**
 * Normalize phone number to international format
 */
export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("07")) {
    return "250" + cleaned.slice(1);
  }
  if (cleaned.startsWith("250")) {
    return cleaned;
  }
  return cleaned;
}

// =====================================================
// LOGGING UTILITIES
// =====================================================

/**
 * Mask phone number for logging (PII protection)
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return "***";
  return phone.slice(0, 4) + "****" + phone.slice(-3);
}

/**
 * Log marketplace event with masked PII
 */
export function logMarketplaceEvent(
  event: string,
  details: Record<string, unknown>,
  level: "info" | "warn" | "error" = "info",
): void {
  // Mask any phone numbers in details
  const maskedDetails = { ...details };
  if (maskedDetails.phone) {
    maskedDetails.phone = maskPhone(maskedDetails.phone as string);
  }
  if (maskedDetails.from) {
    maskedDetails.from = maskPhone(maskedDetails.from as string);
  }
  if (maskedDetails.seller_phone) {
    maskedDetails.seller_phone = maskPhone(maskedDetails.seller_phone as string);
  }
  if (maskedDetails.buyer_phone) {
    maskedDetails.buyer_phone = maskPhone(maskedDetails.buyer_phone as string);
  }

  // Log via structured logging (visible in Supabase Dashboard)
  logStructuredEvent(`MARKETPLACE_${event}`, {
    service: "wa-webhook-marketplace",
    ...maskedDetails,
  }, level);
}
