import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import {
  getMarketConfig,
  matchCommodity,
  matchVariety,
  normalize,
  type FarmerMarketConfig,
} from "../../../config/farmer-agent/markets/index.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase credentials for notify-buyers function");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as NotifyRequest;

    if (!payload.marketCode || !Array.isArray(payload.buyers) || payload.buyers.length === 0) {
      return jsonResponse({ error: 'marketCode and at least one buyer are required' }, 400);
    }

    const market = getMarketConfig(payload.marketCode);
    if (!market) {
      return jsonResponse({ error: `Unknown market ${payload.marketCode}` }, 404);
    }

    const commodityRule = matchCommodity(market, payload.commodity);
    if (!commodityRule) {
      return jsonResponse({ error: `Commodity ${payload.commodity} not configured for ${market.marketCode}` }, 400);
    }

    const varietyRule = matchVariety(commodityRule, payload.variety);
    if (!varietyRule) {
      return jsonResponse({ error: `Variety ${payload.variety ?? ''} not supported for ${payload.commodity}` }, 400);
    }

    const grade = normalizeGrade(varietyRule, payload.grade);

    const marketDate = resolveMarketDate(market, payload.marketDate);
    const sendWindows = computeSendWindows(market, marketDate);

    if (sendWindows.length === 0) {
      return jsonResponse({ error: 'No valid alert window available (market date already passed)' }, 400);
    }

    const produceDescriptor = await fetchProduceDescriptor(market, commodityRule.commodity, varietyRule.code, grade);

    const alerts = buildAlerts(payload.buyers, market, varietyRule.name, grade, sendWindows, produceDescriptor);

    if (alerts.length === 0) {
      return jsonResponse({ error: 'No schedulable buyers found' }, 400);
    }

    const { data, error } = await supabase
      .from('buyer_market_alerts')
      .insert(alerts)
      .select();

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({
      success: true,
      scheduled: data,
      marketDate: marketDate.toISOString(),
      marketCode: market.marketCode,
    });
  } catch (error) {
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});

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
