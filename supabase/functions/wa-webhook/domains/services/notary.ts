import type { RouterContext } from "../../types.ts";
import { clearState, setState } from "../../state/store.ts";
import { t } from "../../i18n/translator.ts";
import { sendText } from "../../wa/client.ts";
import {
  buildButtons,
  homeOnly,
  sendButtonsMessage,
  sendListMessage,
} from "../../utils/reply.ts";
import { isFeatureEnabled } from "../../../_shared/feature-flags.ts";
import { IDS } from "../../wa/ids.ts";
import { routeToAIAgent, sendAgentOptions } from "../ai-agents/index.ts";
import { waChatLink } from "../../utils/links.ts";
// Marketplace retired: query business table directly

const NOTARY_RESULT_PREFIX = "NOTARY::";

export type NotaryResultsState = {
  entries: Array<{ id: string; name: string; whatsapp: string }>;
  prefill?: string | null;
};

/**
 * Start Notary Services flow
 * User needs to provide location
 */
export async function startNotaryServices(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: "notary_awaiting_location",
    data: {},
  });

  const instructions = t(ctx.locale, "location.share.instructions");
  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "notary.start.prompt", { instructions }),
    buildButtons(
      { id: IDS.LOCATION_SAVED_LIST, title: t(ctx.locale, "location.saved.button") },
      { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") }
    ),
  );

  return true;
}

/**
 * Handle location received for notary services
 */
export async function handleNotaryLocation(
  ctx: RouterContext,
  location: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: "notary_awaiting_service",
    data: { location },
  });

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "notary.location.received"),
    buildButtons(
      { id: "notary_add_service", title: t(ctx.locale, "notary.buttons.specify_service") },
      { id: "notary_search_now", title: t(ctx.locale, "notary.buttons.search_now") },
      { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") }
    ),
  );

  return true;
}

/**
 * Process notary service request - DIRECT DATABASE APPROACH
 * Phase 1: Simple workflow - User shares location → Instant database results
 * Phase 2: AI agents disabled for nearby searches (to be enabled later)
 */
export async function processNotaryRequest(
  ctx: RouterContext,
  location: { lat: number; lng: number },
  rawInput: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  const serviceType = parseServiceType(rawInput);
  
  // Show all nearby notaries (no service type required for Phase 1)
  // If service type specified, use it for WhatsApp message prefill only
  
  // DIRECT DATABASE RESULTS: Instant top 9 nearby notaries
  const instantResults = await sendNotaryDatabaseResults(ctx, location, serviceType);
  
  /* AI AGENT DISABLED FOR PHASE 1 - Will be enabled in Phase 2
  // Phase 2: Trigger AI agent in background (if enabled)
  if (isFeatureEnabled("agent.notary") && instantResults) {
    // Start AI agent processing in background - non-blocking
    triggerNotaryAgentBackground(ctx, location, serviceType).catch((error) => {
      console.error("notary.background_agent_error", error);
    });
  }
  */
  
  return instantResults;
}

/**
 * Handle user selection from notary results
 */
export async function handleNotaryResultSelection(
  ctx: RouterContext,
  state: NotaryResultsState,
  id: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return false;
  
  const serviceText = state.prefill?.length ? state.prefill : null;
  const message = serviceText
    ? t(ctx.locale, "notary.prefill.with_service", { service: serviceText })
    : t(ctx.locale, "notary.prefill.generic");
  
  const link = waChatLink(entry.whatsapp, message);
  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "notary.results.chat_cta", { link }),
    homeOnly(),
  );
  await clearState(ctx.supabase, ctx.profileId);
  return true;
}

/**
 * Parse service type from user input
 */
function parseServiceType(input: string): string[] {
  return input.split(/[\n,]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}

/**
 * Phase 1: Send immediate database results (top 9 nearby notaries)
 * This provides instant results while AI agent processes in background
 */
async function sendNotaryDatabaseResults(
  ctx: RouterContext,
  location: { lat: number; lng: number },
  serviceType: string[],
): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  let entries: Array<{
    id: string;
    name: string;
    owner_whatsapp?: string | null;
    distance_km?: number | null;
    location_text?: string | null;
    description?: string | null;
  }> = [];
  
  try {
    // Direct DB query for notaries (category/tag/description contains 'notary')
    const { data, error } = await ctx.supabase
      .from('business')
      .select('id, name, owner_whatsapp, location_text, description, lat, lng, latitude, longitude')
      .eq('is_active', true)
      .or([
        'category_name.ilike.%notary%',
        'tag.ilike.%notary%',
        'description.ilike.%notary%'
      ].join(','))
      .limit(24);
    if (error) throw error;

    const toNumber = (v: any) => (typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(v) : NaN));
    const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371;
      const toRad = (x: number) => x * Math.PI / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    const enriched = (data || []).map((row: any) => {
      const lat = Number.isFinite(toNumber(row.lat)) ? toNumber(row.lat) : toNumber(row.latitude);
      const lng = Number.isFinite(toNumber(row.lng)) ? toNumber(row.lng) : toNumber(row.longitude);
      const distance_km = Number.isFinite(lat) && Number.isFinite(lng)
        ? haversine(location.lat, location.lng, lat, lng)
        : null;
      return { ...row, distance_km };
    });

    enriched.sort((a, b) => {
      if (a.distance_km === null && b.distance_km === null) return 0;
      if (a.distance_km === null) return 1;
      if (b.distance_km === null) return -1;
      return a.distance_km - b.distance_km;
    });

    entries = enriched.map((row: any) => ({
      id: row.id,
      name: row.name,
      owner_whatsapp: row.owner_whatsapp,
      distance_km: row.distance_km,
      location_text: row.location_text,
      description: row.description,
    }));
  } catch (error) {
    console.error("notary.database_fetch_failed", error);
  }
  
  const withContacts = entries.filter((entry) => entry.owner_whatsapp);
  
  if (!withContacts.length) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "notary.results.empty"),
      homeOnly(),
    );
    return true;
  }
  
  // Show top 9 results
  const top9 = withContacts.slice(0, 9);
  const rows = top9.map((entry) => ({
    id: `${NOTARY_RESULT_PREFIX}${entry.id}`,
    name: entry.name ?? t(ctx.locale, "notary.results.unknown"),
    description: formatNotaryDescription(ctx, entry),
    whatsapp: entry.owner_whatsapp!,
  }));

  await setState(ctx.supabase, ctx.profileId, {
    key: "notary_results",
    data: {
      entries: rows.map((row) => ({
        id: row.id,
        name: row.name,
        whatsapp: row.whatsapp,
      })),
      prefill: serviceType.join(", ") || null,
    } as Record<string, unknown>,
  });

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "notary.results.title"),
      body: t(ctx.locale, "notary.results.instant_body"),
      sectionTitle: t(ctx.locale, "notary.results.section"),
      rows: [
        ...rows.map((row) => ({
          id: row.id,
          title: `📜 ${row.name}`,
          description: row.description,
        })),
        {
          id: IDS.BACK_MENU,
          title: t(ctx.locale, "common.menu_back"),
          description: t(ctx.locale, "common.back_to_menu.description"),
        },
      ],
      buttonText: t(ctx.locale, "common.buttons.open"),
    },
    { emoji: "📜" },
  );
  
  return true;
}

/**
 * Phase 2: Background AI agent processing
 * Agent contacts notaries on behalf of user to create curated shortlist
 */
async function triggerNotaryAgentBackground(
  ctx: RouterContext,
  location: { lat: number; lng: number },
  serviceType: string[],
): Promise<void> {
  if (!ctx.profileId) return;
  
  try {
    // Send notification that AI agent is working in background
    await sendText(
      ctx.from,
      t(ctx.locale, "notary.agent_processing_background"),
    );
    
    const response = await routeToAIAgent(ctx, {
      userId: ctx.from,
      agentType: "notary",
      flowType: "find_services",
      location: {
        latitude: location.lat,
        longitude: location.lng,
      },
      requestData: {
        serviceType,
        documentType: undefined,
      },
    });

    if (response.success && response.options?.length) {
      // AI agent found curated results - send them
      await sendText(
        ctx.from,
        t(ctx.locale, "notary.agent_curated_ready"),
      );
      
      await sendAgentOptions(
        ctx,
        response.sessionId,
        response.options,
        t(ctx.locale, "notary.agent_curated_results"),
      );
      
      await setState(ctx.supabase, ctx.profileId, {
        key: "ai_agent_selection",
        data: {
          sessionId: response.sessionId,
          agentType: "notary",
        },
      });
    } else if (response.message) {
      // AI agent completed but no better results
      await sendText(ctx.from, response.message);
    }
  } catch (error) {
    console.error("notary.background_agent_failure", error);
    // Silent failure - user already has database results
  }
}

/**
 * Format notary business description for display
 */
function formatNotaryDescription(
  ctx: RouterContext,
  entry: {
    distance_km?: number | null;
    location_text?: string | null;
    description?: string | null;
  },
): string {
  const parts: string[] = [];
  
  if (typeof entry.distance_km === "number") {
    const distLabel = entry.distance_km >= 1
      ? `${entry.distance_km.toFixed(1)} km`
      : `${Math.round(entry.distance_km * 1000)} m`;
    parts.push(`Distance: ${distLabel}`);
  }
  
  if (entry.location_text?.trim()) {
    parts.push(entry.location_text.trim());
  } else if (entry.description?.trim()) {
    parts.push(entry.description.trim());
  }
  
  return parts.join(" • ");
}
