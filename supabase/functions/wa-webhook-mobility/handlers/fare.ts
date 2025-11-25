// ============================================================================
// FARE CALCULATION - PHASE 3
// ============================================================================
// Handles fare estimation and calculation for mobility trips
// ============================================================================

import { logStructuredEvent } from "../observe/observability.ts";
import { calculateHaversineDistance } from "./tracking.ts";
import type { Coordinates } from "./tracking.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface FareEstimate {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  surgePricing: number;
  subtotal: number;
  tax: number;
  totalFare: number;
  currency: string;
  breakdown: FareBreakdown;
}

export interface FareBreakdown {
  distanceKm: number;
  estimatedMinutes: number;
  surgeMultiplier: number;
  taxRate: number;
}

export interface PricingConfig {
  baseFare: number;
  perKm: number;
  perMinute: number;
  minimumFare: number;
  currency: string;
}

// ============================================================================
// PRICING CONFIGURATION
// ============================================================================

/**
 * Pricing configuration by vehicle type (in RWF)
 * TODO: Move to database configuration table for dynamic pricing
 */
export const PRICING_CONFIG: Record<string, PricingConfig> = {
  sedan: {
    baseFare: 1000,
    perKm: 500,
    perMinute: 100,
    minimumFare: 1500,
    currency: "RWF",
  },
  suv: {
    baseFare: 1500,
    perKm: 700,
    perMinute: 150,
    minimumFare: 2000,
    currency: "RWF",
  },
  motorcycle: {
    baseFare: 500,
    perKm: 300,
    perMinute: 50,
    minimumFare: 1000,
    currency: "RWF",
  },
  bus: {
    baseFare: 3000,
    perKm: 1000,
    perMinute: 200,
    minimumFare: 4000,
    currency: "RWF",
  },
  truck: {
    baseFare: 5000,
    perKm: 1500,
    perMinute: 300,
    minimumFare: 6000,
    currency: "RWF",
  },
};

/**
 * Tax configuration
 * TODO: Make configurable per country/region
 */
export const TAX_RATE = 0.18; // 18% VAT in Rwanda

/**
 * Surge pricing configuration
 * TODO: Implement dynamic surge pricing based on demand
 */
export const SURGE_PRICING = {
  enabled: false,
  peakHours: [7, 8, 9, 17, 18, 19], // Morning and evening rush hours
  weekendMultiplier: 1.2,
  peakHourMultiplier: 1.5,
  highDemandMultiplier: 2.0,
};

// ============================================================================
// FARE ESTIMATION
// ============================================================================

/**
 * Calculates fare estimate for a trip
 * Used before trip starts to show estimated cost
 */
export async function calculateFareEstimate(
  pickup: Coordinates,
  dropoff: Coordinates | null,
  vehicleType: string
): Promise<FareEstimate> {
  try {
    // Get pricing config for vehicle type
    const config = PRICING_CONFIG[vehicleType.toLowerCase()];
    if (!config) {
      throw new Error(`Unknown vehicle type: ${vehicleType}`);
    }

    // Calculate distance
    let distanceKm = 0;
    if (dropoff) {
      distanceKm = calculateHaversineDistance(pickup, dropoff);
      // Apply route factor (road distance is typically 30% longer than straight line)
      distanceKm *= 1.3;
    }

    // Estimate time (assuming average speed of 30 km/h in urban areas)
    const averageSpeedKmh = 30;
    const estimatedMinutes = dropoff 
      ? Math.ceil((distanceKm / averageSpeedKmh) * 60)
      : 0;

    // Calculate base components
    const baseFare = config.baseFare;
    const distanceFare = distanceKm * config.perKm;
    const timeFare = estimatedMinutes * config.perMinute;

    // Calculate surge pricing multiplier
    const surgeMultiplier = calculateSurgeMultiplier();
    const surgePricing = (baseFare + distanceFare + timeFare) * (surgeMultiplier - 1);

    // Calculate subtotal
    const subtotal = baseFare + distanceFare + timeFare + surgePricing;

    // Apply minimum fare
    const fareBeforeTax = Math.max(subtotal, config.minimumFare);

    // Calculate tax
    const tax = fareBeforeTax * TAX_RATE;

    // Calculate total
    const totalFare = Math.round(fareBeforeTax + tax);

    const estimate: FareEstimate = {
      baseFare: Math.round(baseFare),
      distanceFare: Math.round(distanceFare),
      timeFare: Math.round(timeFare),
      surgePricing: Math.round(surgePricing),
      subtotal: Math.round(subtotal),
      tax: Math.round(tax),
      totalFare,
      currency: config.currency,
      breakdown: {
        distanceKm: parseFloat(distanceKm.toFixed(2)),
        estimatedMinutes,
        surgeMultiplier,
        taxRate: TAX_RATE,
      },
    };

    await logStructuredEvent("FARE_ESTIMATED", {
      vehicleType,
      distanceKm: estimate.breakdown.distanceKm,
      estimatedMinutes,
      totalFare: estimate.totalFare,
      surgeMultiplier,
    });

    return estimate;
  } catch (error) {
    await logStructuredEvent("FARE_ESTIMATION_ERROR", {
      vehicleType,
      error: error.message,
    }, "error");

    // Return default estimate on error
    const config = PRICING_CONFIG.sedan;
    return {
      baseFare: config.baseFare,
      distanceFare: 0,
      timeFare: 0,
      surgePricing: 0,
      subtotal: config.baseFare,
      tax: Math.round(config.baseFare * TAX_RATE),
      totalFare: Math.round(config.baseFare * (1 + TAX_RATE)),
      currency: config.currency,
      breakdown: {
        distanceKm: 0,
        estimatedMinutes: 0,
        surgeMultiplier: 1.0,
        taxRate: TAX_RATE,
      },
    };
  }
}

// ============================================================================
// ACTUAL FARE CALCULATION
// ============================================================================

/**
 * Calculates actual fare after trip completion
 * Uses actual distance and time from trip
 */
export async function calculateActualFare(
  vehicleType: string,
  actualDistanceKm: number,
  actualDurationMinutes: number
): Promise<FareEstimate> {
  try {
    // Get pricing config for vehicle type
    const config = PRICING_CONFIG[vehicleType.toLowerCase()];
    if (!config) {
      throw new Error(`Unknown vehicle type: ${vehicleType}`);
    }

    // Calculate components based on actual values
    const baseFare = config.baseFare;
    const distanceFare = actualDistanceKm * config.perKm;
    const timeFare = actualDurationMinutes * config.perMinute;

    // Calculate surge pricing (if applicable at time of trip)
    const surgeMultiplier = calculateSurgeMultiplier();
    const surgePricing = (baseFare + distanceFare + timeFare) * (surgeMultiplier - 1);

    // Calculate subtotal
    const subtotal = baseFare + distanceFare + timeFare + surgePricing;

    // Apply minimum fare
    const fareBeforeTax = Math.max(subtotal, config.minimumFare);

    // Calculate tax
    const tax = fareBeforeTax * TAX_RATE;

    // Calculate total
    const totalFare = Math.round(fareBeforeTax + tax);

    const actualFare: FareEstimate = {
      baseFare: Math.round(baseFare),
      distanceFare: Math.round(distanceFare),
      timeFare: Math.round(timeFare),
      surgePricing: Math.round(surgePricing),
      subtotal: Math.round(subtotal),
      tax: Math.round(tax),
      totalFare,
      currency: config.currency,
      breakdown: {
        distanceKm: parseFloat(actualDistanceKm.toFixed(2)),
        estimatedMinutes: actualDurationMinutes,
        surgeMultiplier,
        taxRate: TAX_RATE,
      },
    };

    await logStructuredEvent("ACTUAL_FARE_CALCULATED", {
      vehicleType,
      distanceKm: actualDistanceKm,
      durationMinutes: actualDurationMinutes,
      totalFare: actualFare.totalFare,
      surgeMultiplier,
    });

    return actualFare;
  } catch (error) {
    await logStructuredEvent("ACTUAL_FARE_CALCULATION_ERROR", {
      vehicleType,
      error: error.message,
    }, "error");

    throw error;
  }
}

// ============================================================================
// SURGE PRICING
// ============================================================================

/**
 * Calculates surge pricing multiplier based on current conditions
 * TODO: Implement dynamic surge based on real demand/supply data
 */
export function calculateSurgeMultiplier(): number {
  if (!SURGE_PRICING.enabled) {
    return 1.0;
  }

  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  let multiplier = 1.0;

  // Weekend surge
  if (day === 0 || day === 6) {
    multiplier *= SURGE_PRICING.weekendMultiplier;
  }

  // Peak hour surge
  if (SURGE_PRICING.peakHours.includes(hour)) {
    multiplier *= SURGE_PRICING.peakHourMultiplier;
  }

  // TODO: Add high demand surge based on driver/passenger ratio
  // const demandRatio = await calculateDemandRatio();
  // if (demandRatio > 2.0) {
  //   multiplier *= SURGE_PRICING.highDemandMultiplier;
  // }

  return multiplier;
}

// ============================================================================
// CANCELLATION FEE
// ============================================================================

/**
 * Calculates cancellation fee based on trip status
 * TODO: Make configurable per business rules
 */
export function calculateCancellationFee(
  tripStatus: string,
  fareEstimate: number
): number {
  switch (tripStatus) {
    case "pending":
    case "accepted":
      // Free cancellation before driver arrives
      return 0;

    case "driver_arrived":
      // 20% of estimated fare if driver already arrived
      return Math.round(fareEstimate * 0.2);

    case "in_progress":
      // 50% of estimated fare if trip already started
      return Math.round(fareEstimate * 0.5);

    default:
      return 0;
  }
}

// ============================================================================
// FARE FORMATTING
// ============================================================================

/**
 * Formats fare for display
 */
export function formatFare(
  amount: number,
  currency: string = "RWF",
  locale: string = "en"
): string {
  if (locale === "rw" || locale === "fr") {
    return `${amount.toLocaleString()} ${currency}`;
  }
  return `${currency} ${amount.toLocaleString()}`;
}

/**
 * Formats fare breakdown for display
 */
export function formatFareBreakdown(estimate: FareEstimate, locale: string = "en"): string {
  const lines = [
    `Base fare: ${formatFare(estimate.baseFare, estimate.currency, locale)}`,
    `Distance (${estimate.breakdown.distanceKm} km): ${formatFare(estimate.distanceFare, estimate.currency, locale)}`,
    `Time (${estimate.breakdown.estimatedMinutes} min): ${formatFare(estimate.timeFare, estimate.currency, locale)}`,
  ];

  if (estimate.surgePricing > 0) {
    lines.push(
      `Surge (${estimate.breakdown.surgeMultiplier}x): ${formatFare(estimate.surgePricing, estimate.currency, locale)}`
    );
  }

  lines.push(
    `Subtotal: ${formatFare(estimate.subtotal, estimate.currency, locale)}`,
    `Tax (${(estimate.breakdown.taxRate * 100).toFixed(0)}%): ${formatFare(estimate.tax, estimate.currency, locale)}`,
    `---`,
    `Total: ${formatFare(estimate.totalFare, estimate.currency, locale)}`
  );

  return lines.join("\n");
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  calculateFareEstimate,
  calculateActualFare,
  calculateSurgeMultiplier,
  calculateCancellationFee,
  formatFare,
  formatFareBreakdown,
  PRICING_CONFIG,
};
