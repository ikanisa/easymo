/**
 * Buyer Alert Scheduler - Internal API
 *
 * Handles buyer alert scheduling for market-based alerts.
 * This is an internal API endpoint for scheduling market alerts to buyers.
 *
 * Features:
 * - Market-based alert scheduling
 * - Produce catalog integration
 * - Multi-window alert scheduling
 * - COD fallback support
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

import {
  type FarmerMarketConfig,
  getMarketConfig,
  matchCommodity,
  matchVariety,
  normalize,
} from "../../../config/farmer-agent/markets/index.ts";
import { logStructuredEvent, recordMetric } from "../_shared/observability.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase credentials for buyer-alert-scheduler function");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SERVICE_NAME = "buyer-alert-scheduler";
const SERVICE_VERSION = "1.0.0";

interface BuyerPayload {
  id?: string;
  phone: string;
  name?: string;
  locale?: string;
  buyerType?: 'merchant' | 'institution';
  paymentPreference?: 'wallet' | 'cod';
  preferredCity?: string;
}

interface NotifyRequest {
  marketCode: string;
  marketDate?: string;
  commodity: string;
  variety?: string;
  grade?: string;
  buyers: BuyerPayload[];
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function fetchProduceDescriptor(
  market: FarmerMarketConfig,
  commodity: string,
  variety: string,
  grade: string,
) {
  const { data } = await supabase
    .from('produce_catalog')
    .select('price_floor, price_ceiling, synonyms, localized_names')
    .eq('market_code', market.marketCode)
    .eq('commodity', commodity)
    .eq('variety', variety)
    .eq('grade', grade)
    .maybeSingle();

  return data ?? null;
}

function computeSendWindows(market: FarmerMarketConfig, marketDate: Date): Date[] {
  const leadHours = market.alertLeadHours && market.alertLeadHours.length > 0 ? market.alertLeadHours : [36, 24];
  const now = Date.now();
  return leadHours
    .map((hours) => new Date(marketDate.getTime() - hours * 60 * 60 * 1000))
    .filter((date) => date.getTime() > now + 5 * 60 * 1000)
    .sort((a, b) => a.getTime() - b.getTime());
}

function resolveMarketDate(market: FarmerMarketConfig, requestedDate?: string): Date {
  if (requestedDate) {
    const parsed = new Date(requestedDate);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const now = new Date();
  const currentDay = now.getUTCDay();
  const targetDays = market.marketDays.map((day) => dayOfWeekToIndex(day));
  let offsetDays = 7;

  for (const day of targetDays) {
    let diff = day - currentDay;
    if (diff <= 0) diff += 7;
    offsetDays = Math.min(offsetDays, diff);
  }

  const nextDate = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  return nextDate;
}

function dayOfWeekToIndex(value: string): number {
  const map: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  return map[value.toLowerCase()] ?? 1;
}

function normalizeGrade(variety: { grades: string[] }, grade?: string) {
  if (!grade) return variety.grades[0];
  if (!variety.grades.some((entry) => normalize(entry) === normalize(grade))) {
    throw new Error(`Grade ${grade} not allowed. Options: ${variety.grades.join(', ')}`);
  }
  return variety.grades.find((entry) => normalize(entry) === normalize(grade)) ?? variety.grades[0];
}

function buildAlerts(
  buyers: BuyerPayload[],
  market: FarmerMarketConfig,
  varietyLabel: string,
  grade: string,
  windows: Date[],
  produceDescriptor: any,
) {
  const alerts: any[] = [];
  const priceHint = buildPriceHint(produceDescriptor, market.currency);

  for (const buyer of buyers) {
    if (!buyer.phone) continue;

    const codFallback = shouldAttachCod(market, buyer) ? market.codFallback : null;

    for (const sendAt of windows) {
      alerts.push({
        buyer_id: buyer.id ?? null,
        buyer_phone: buyer.phone,
        buyer_type: buyer.buyerType ?? 'merchant',
        market_code: market.marketCode,
        template_intent: 'produce_market_alert',
        template_locale: buyer.locale ?? market.locale ?? 'en',
        channel: 'whatsapp',
        payload: {
          buyerName: buyer.name ?? buyer.phone,
          commodity: varietyLabel,
          grade,
          marketDay: sendAt.toLocaleDateString('en-US', { weekday: 'long', timeZone: market.timezone }),
          city: buyer.preferredCity ?? market.allowedCities[0],
          priceHint,
        },
        cod_fallback: codFallback,
        send_at: sendAt.toISOString(),
        status: 'scheduled',
      });
    }
  }

  return alerts;
}

function shouldAttachCod(market: FarmerMarketConfig, buyer: BuyerPayload) {
  if (!market.codFallback?.enabled) return false;
  if (buyer.paymentPreference === 'wallet') return false;
  return (buyer.buyerType ?? 'merchant') === 'merchant';
}

function buildPriceHint(descriptor: any, currency: string) {
  if (!descriptor) return null;
  if (descriptor.price_floor && descriptor.price_ceiling) {
    return `${descriptor.price_floor}-${descriptor.price_ceiling} ${currency}`;
  }
  if (descriptor.price_floor) {
    return `${descriptor.price_floor}+ ${currency}`;
  }
  return null;
}

serve(async (req: Request): Promise<Response> => {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const correlationId = req.headers.get("x-correlation-id") ?? requestId;
  const startTime = Date.now();

  const respond = (body: unknown, init: ResponseInit = {}): Response => {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    headers.set("X-Request-ID", requestId);
    headers.set("X-Correlation-ID", correlationId);
    headers.set("X-Service", SERVICE_NAME);
    headers.set("X-Service-Version", SERVICE_VERSION);
    return new Response(JSON.stringify(body), { ...init, headers });
  };

  // Handle OPTIONS for CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check endpoint
  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.pathname.endsWith("/health") || url.pathname === "/health") {
      return respond({
        status: "healthy",
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        timestamp: new Date().toISOString(),
      });
    }
    return respond({ error: "method_not_allowed" }, { status: 405 });
  }

  // Only POST is allowed for scheduling
  if (req.method !== "POST") {
    return respond({ error: "method_not_allowed" }, { status: 405 });
  }

  try {
    // Check if scheduling is enabled
    const schedulingEnabled = (Deno.env.get("ENABLE_BUYER_ALERT_SCHEDULING") ?? "false")
      .toLowerCase() === "true";
    if (!schedulingEnabled) {
      await logStructuredEvent("BUYER_ALERT_SCHEDULING_DISABLED", {
        requestId,
        correlationId,
      }, "warn");
      return respond({ error: "buyer_alert_scheduling_disabled" }, { status: 503 });
    }

    // Parse request payload
    let payload: NotifyRequest;
    try {
      payload = await req.json() as NotifyRequest;
    } catch (parseError) {
      await logStructuredEvent("BUYER_ALERT_SCHEDULING_PARSE_ERROR", {
        requestId,
        correlationId,
        error: parseError instanceof Error ? parseError.message : String(parseError),
      }, "error");
      return respond({ error: "invalid_json", message: "Invalid JSON payload" }, { status: 400 });
    }

    // Validate required fields
    if (!payload.marketCode || !Array.isArray(payload.buyers) || payload.buyers.length === 0) {
      await logStructuredEvent("BUYER_ALERT_SCHEDULING_VALIDATION_ERROR", {
        requestId,
        correlationId,
        hasMarketCode: !!payload.marketCode,
        buyerCount: payload.buyers?.length || 0,
      }, "warn");
      return respond({ error: 'marketCode and at least one buyer are required' }, { status: 400 });
    }

    // Get market configuration
    const market = getMarketConfig(payload.marketCode);
    if (!market) {
      await logStructuredEvent("BUYER_ALERT_SCHEDULING_UNKNOWN_MARKET", {
        requestId,
        correlationId,
        marketCode: payload.marketCode,
      }, "warn");
      return respond({ error: `Unknown market ${payload.marketCode}` }, { status: 404 });
    }

    // Match commodity
    const commodityRule = matchCommodity(market, payload.commodity);
    if (!commodityRule) {
      await logStructuredEvent("BUYER_ALERT_SCHEDULING_UNKNOWN_COMMODITY", {
        requestId,
        correlationId,
        marketCode: payload.marketCode,
        commodity: payload.commodity,
      }, "warn");
      return respond({ error: `Commodity ${payload.commodity} not configured for ${market.marketCode}` }, { status: 400 });
    }

    // Match variety
    const varietyRule = matchVariety(commodityRule, payload.variety);
    if (!varietyRule) {
      await logStructuredEvent("BUYER_ALERT_SCHEDULING_UNKNOWN_VARIETY", {
        requestId,
        correlationId,
        commodity: payload.commodity,
        variety: payload.variety,
      }, "warn");
      return respond({ error: `Variety ${payload.variety ?? ''} not supported for ${payload.commodity}` }, { status: 400 });
    }

    // Normalize grade
    let grade: string;
    try {
      grade = normalizeGrade(varietyRule, payload.grade);
    } catch (gradeError) {
      await logStructuredEvent("BUYER_ALERT_SCHEDULING_INVALID_GRADE", {
        requestId,
        correlationId,
        grade: payload.grade,
        availableGrades: varietyRule.grades,
      }, "warn");
      return respond({ error: gradeError instanceof Error ? gradeError.message : "Invalid grade" }, { status: 400 });
    }

    // Resolve market date
    const marketDate = resolveMarketDate(market, payload.marketDate);
    const sendWindows = computeSendWindows(market, marketDate);

    if (sendWindows.length === 0) {
      await logStructuredEvent("BUYER_ALERT_SCHEDULING_NO_WINDOWS", {
        requestId,
        correlationId,
        marketDate: marketDate.toISOString(),
      }, "warn");
      return respond({ error: 'No valid alert window available (market date already passed)' }, { status: 400 });
    }

    // Fetch produce descriptor
    const produceDescriptor = await fetchProduceDescriptor(market, commodityRule.commodity, varietyRule.code, grade);

    // Build alerts
    const alerts = buildAlerts(payload.buyers, market, varietyRule.name, grade, sendWindows, produceDescriptor);

    if (alerts.length === 0) {
      await logStructuredEvent("BUYER_ALERT_SCHEDULING_NO_ALERTS", {
        requestId,
        correlationId,
        buyerCount: payload.buyers.length,
      }, "warn");
      return respond({ error: 'No schedulable buyers found' }, { status: 400 });
    }

    // Insert alerts into database
    const { data, error } = await supabase
      .from('buyer_market_alerts')
      .insert(alerts)
      .select();

    if (error) {
      await logStructuredEvent("BUYER_ALERT_SCHEDULING_DB_ERROR", {
        requestId,
        correlationId,
        error: error.message,
        errorCode: error.code,
      }, "error");
      return respond({ error: error.message }, { status: 500 });
    }

    const duration = Date.now() - startTime;
    await logStructuredEvent("BUYER_ALERT_SCHEDULING_SUCCESS", {
      requestId,
      correlationId,
      marketCode: market.marketCode,
      alertCount: alerts.length,
      buyerCount: payload.buyers.length,
      durationMs: duration,
    });

    await recordMetric("buyer_alert_scheduler.alerts_scheduled", alerts.length, {
      marketCode: market.marketCode,
    });

    return respond({
      success: true,
      scheduled: data,
      marketDate: marketDate.toISOString(),
      marketCode: market.marketCode,
      alertCount: alerts.length,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    await logStructuredEvent("BUYER_ALERT_SCHEDULING_ERROR", {
      requestId,
      correlationId,
      error: errorMessage,
      stack: errorStack,
      durationMs: duration,
    }, "error");

    await recordMetric("buyer_alert_scheduler.error", 1, {
      error_type: "unexpected_error",
    });

    return respond({
      error: "internal_error",
      message: "An unexpected error occurred while scheduling alerts",
    }, { status: 500 });
  }
});

logStructuredEvent("SERVICE_STARTED", {
  service: SERVICE_NAME,
  version: SERVICE_VERSION,
});

