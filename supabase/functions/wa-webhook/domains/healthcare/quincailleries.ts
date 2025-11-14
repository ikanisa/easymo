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
import { listBusinesses } from "../../rpc/marketplace.ts";

const QUINCA_RESULT_PREFIX = "QUIN::";

export type QuincaResultsState = {
  entries: Array<{ id: string; name: string; whatsapp: string }>;
  prefill?: string | null;
};

export async function startNearbyQuincailleries(
  ctx: RouterContext,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: "quincaillerie_awaiting_location",
    data: {},
  });

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "quincaillerie.start.prompt"),
    buildButtons(
      { id: IDS.LOCATION_SAVED_LIST, title: t(ctx.locale, "location.saved.button") },
      { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") }
    ),
  );

  return true;
}

export async function handleQuincaillerieLocation(
  ctx: RouterContext,
  location: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId) return false;
  
  // Prompt for item name or image

  await setState(ctx.supabase, ctx.profileId, {
    key: "quincaillerie_awaiting_items",
    data: { location },
  });

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "quincaillerie.location.received"),
    buildButtons(
      { id: IDS.BACK_HOME, title: t(ctx.locale, "common.menu_back") }
    ),
  );

  return true;
}

export async function processQuincaillerieRequest(
  ctx: RouterContext,
  location: { lat: number; lng: number },
  rawInput: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const items = parseKeywords(rawInput);
  if (!items.length) {
    await sendText(ctx.from, t(ctx.locale, "quincaillerie.prompt.items"));
    return true;
  }
  
  // TWO-PHASE APPROACH:
  // Phase 1: Immediately show top 9 nearby quincailleries from database
  // Phase 2: AI agent processes in background for curated shortlist
  
  // Phase 1: Instant database results
  const instantResults = await sendQuincaillerieDatabaseResults(ctx, location, items);
  
  // Phase 2: Trigger AI agent in background (if enabled)
  if (isFeatureEnabled("agent.quincaillerie") && instantResults) {
    // Start AI agent processing in background - non-blocking
    triggerQuincaillerieAgentBackground(ctx, location, items).catch((error) => {
      console.error("quincaillerie.background_agent_error", error);
    });
  }
  
  return instantResults;
}

export async function handleQuincaillerieResultSelection(
  ctx: RouterContext,
  state: QuincaResultsState,
  id: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return false;
  const itemsText = state.prefill?.length ? state.prefill : null;
  const message = itemsText
    ? t(ctx.locale, "quincaillerie.prefill.with_items", { items: itemsText })
    : t(ctx.locale, "quincaillerie.prefill.generic");
  const link = waChatLink(entry.whatsapp, message);
  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "quincaillerie.results.chat_cta", { link }),
    homeOnly(),
  );
  await clearState(ctx.supabase, ctx.profileId);
  return true;
}

function parseKeywords(input: string): string[] {
  return input.split(/[\n,]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}

async function tryQuincaillerieAgent(
  ctx: RouterContext,
  location: { lat: number; lng: number },
  items: string[],
): Promise<boolean> {
  await sendText(ctx.from, t(ctx.locale, "agent.searching_hardware_stores"));
  try {
    const response = await routeToAIAgent(ctx, {
      userId: ctx.from,
      agentType: "quincaillerie",
      flowType: "find_items",
      location: {
        latitude: location.lat,
        longitude: location.lng,
      },
      requestData: {
        items,
        itemImage: undefined,
      },
    });

    if (response.success && response.options?.length) {
      await sendAgentOptions(
        ctx,
        response.sessionId,
        response.options,
        t(ctx.locale, "quincaillerie.options_found"),
      );
      await setState(ctx.supabase, ctx.profileId!, {
        key: "ai_agent_selection",
        data: {
          sessionId: response.sessionId,
          agentType: "quincaillerie",
        },
      });
      return true;
    }

    if (response.message) {
      await sendText(ctx.from, response.message);
    }
  } catch (error) {
    console.error("quincaillerie.agent_failure", error);
    await sendText(ctx.from, t(ctx.locale, "agent.error_occurred"));
  }
  return false;
}

async function sendQuincaillerieFallback(
  ctx: RouterContext,
  location: { lat: number; lng: number },
  items: string[],
): Promise<boolean> {
  return await sendQuincaillerieDatabaseResults(ctx, location, items);
}

/**
 * Phase 1: Send immediate database results (top 9 nearby quincailleries)
 * This provides instant results while AI agent processes in background
 */
async function sendQuincaillerieDatabaseResults(
  ctx: RouterContext,
  location: { lat: number; lng: number },
  items: string[],
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
    // Fetch top 12, filter for contacts, show top 9
    entries = await listBusinesses(
      ctx.supabase,
      location,
      "quincailleries",
      12,
    );
  } catch (error) {
    console.error("quincaillerie.database_fetch_failed", error);
  }
  
  const withContacts = entries.filter((entry) => entry.owner_whatsapp);
  
  if (!withContacts.length) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "quincaillerie.results.empty"),
      homeOnly(),
    );
    return true;
  }
  
  // Show top 9 results
  const top9 = withContacts.slice(0, 9);
  const rows = top9.map((entry) => ({
    id: `${QUINCA_RESULT_PREFIX}${entry.id}`,
    name: entry.name ?? t(ctx.locale, "quincaillerie.results.unknown"),
    description: formatBusinessDescription(ctx, entry),
    whatsapp: entry.owner_whatsapp!,
  }));

  await setState(ctx.supabase, ctx.profileId, {
    key: "quincaillerie_results",
    data: {
      entries: rows.map((row) => ({
        id: row.id,
        name: row.name,
        whatsapp: row.whatsapp,
      })),
      prefill: items.join(", ") || null,
    } as Record<string, unknown>,
  });

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "quincaillerie.results.title"),
      body: t(ctx.locale, "quincaillerie.results.instant_body"),
      sectionTitle: t(ctx.locale, "quincaillerie.results.section"),
      rows: [
        ...rows.map((row) => ({
          id: row.id,
          title: `🔧 ${row.name}`,
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
    { emoji: "🔧" },
  );
  
  return true;
}

/**
 * Phase 2: Background AI agent processing
 * Agent contacts quincailleries on behalf of user to create curated shortlist
 */
async function triggerQuincaillerieAgentBackground(
  ctx: RouterContext,
  location: { lat: number; lng: number },
  items: string[],
): Promise<void> {
  if (!ctx.profileId) return;
  
  try {
    // Send notification that AI agent is working in background
    await sendText(
      ctx.from,
      t(ctx.locale, "quincaillerie.agent_processing_background"),
    );
    
    const response = await routeToAIAgent(ctx, {
      userId: ctx.from,
      agentType: "quincaillerie",
      flowType: "find_items",
      location: {
        latitude: location.lat,
        longitude: location.lng,
      },
      requestData: {
        items,
        itemImage: undefined,
      },
    });

    if (response.success && response.options?.length) {
      // AI agent found curated results - send them
      await sendText(
        ctx.from,
        t(ctx.locale, "quincaillerie.agent_curated_ready"),
      );
      
      await sendAgentOptions(
        ctx,
        response.sessionId,
        response.options,
        t(ctx.locale, "quincaillerie.agent_curated_results"),
      );
      
      await setState(ctx.supabase, ctx.profileId, {
        key: "ai_agent_selection",
        data: {
          sessionId: response.sessionId,
          agentType: "quincaillerie",
        },
      });
    } else if (response.message) {
      // AI agent completed but no better results
      await sendText(ctx.from, response.message);
    }
  } catch (error) {
    console.error("quincaillerie.background_agent_failure", error);
    // Silent failure - user already has database results
  }
}

async function sendQuincaillerieFallbackOld(
  ctx: RouterContext,
  location: { lat: number; lng: number },
  items: string[],
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
    entries = await listBusinesses(
      ctx.supabase,
      location,
      "quincailleries",
      12,
    );
  } catch (error) {
    console.error("quincaillerie.fallback_fetch_failed", error);
  }
  const withContacts = entries.filter((entry) => entry.owner_whatsapp);
  if (!withContacts.length) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "quincaillerie.results.empty"),
      homeOnly(),
    );
    return true;
  }
  const rows = withContacts.slice(0, 10).map((entry) => ({
    id: `${QUINCA_RESULT_PREFIX}${entry.id}`,
    name: entry.name ?? t(ctx.locale, "quincaillerie.results.unknown"),
    description: formatBusinessDescription(ctx, entry),
    whatsapp: entry.owner_whatsapp!,
  }));

  await setState(ctx.supabase, ctx.profileId, {
    key: "quincaillerie_results",
    data: {
      entries: rows.map((row) => ({
        id: row.id,
        name: row.name,
        whatsapp: row.whatsapp,
      })),
      prefill: items.join(", ") || null,
    } as Record<string, unknown>,
  });

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "quincaillerie.results.title"),
      body: t(ctx.locale, "quincaillerie.results.body"),
      sectionTitle: t(ctx.locale, "quincaillerie.results.section"),
      rows: [
        ...rows.map((row) => ({
          id: row.id,
          title: `🔧 ${row.name}`,
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
    { emoji: "🔧" },
  );
  return true;
}

function formatBusinessDescription(
  ctx: RouterContext,
  entry: {
    distance_km?: number | null;
    location_text?: string | null;
    description?: string | null;
  },
): string {
  const parts: string[] = [];
  if (typeof entry.distance_km === "number") {
    parts.push(
      t(ctx.locale, "marketplace.distance", {
        distance: entry.distance_km >= 1
          ? `${entry.distance_km.toFixed(1)} km`
          : `${Math.round(entry.distance_km * 1000)} m`,
      }),
    );
  }
  if (entry.location_text?.trim()) {
    parts.push(entry.location_text.trim());
  } else if (entry.description?.trim()) {
    parts.push(entry.description.trim());
  }
  return parts.join(" • ");
}
