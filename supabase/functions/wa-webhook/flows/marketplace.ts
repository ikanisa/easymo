import type { RouterContext } from "../types.ts";
import { sendList, sendText } from "../wa/client.ts";
import { clearState, setState } from "../state/store.ts";
import { maskPhone } from "./support.ts";
import { sendHomeMenu } from "./home.ts";
import { createBusiness, listBusinesses } from "../rpc/marketplace.ts";

const MARKETPLACE_STATES = {
  ADD_NAME: "market_add_name",
  ADD_DESC: "market_add_desc",
  ADD_CATALOG: "market_add_catalog",
  ADD_LOCATION: "market_add_location",
  BROWSE_LOCATION: "market_browse_location",
  RESULTS: "market_results",
} as const;

export async function startMarketplace(
  ctx: RouterContext,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (!ctx.profileId) return false;
  await setState(ctx.supabase, ctx.profileId, {
    key: MARKETPLACE_STATES.ADD_NAME,
    data: {},
  });
  await sendText(
    ctx.from,
    "Share details about your business. Send name (max 40 chars).",
  );
  await sendText(ctx.from, "Or send 'browse' to look around.");
  return true;
}

export async function handleMarketplaceText(
  ctx: RouterContext,
  body: string,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const trimmed = body.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower === "skip") {
    return await handleMarketplaceSkip(ctx, state);
  }
  if (lower === "browse") {
    await setState(ctx.supabase, ctx.profileId, {
      key: MARKETPLACE_STATES.BROWSE_LOCATION,
      data: {},
    });
    await sendText(ctx.from, "Share your location to see businesses near you.");
    return true;
  }
  switch (state.key) {
    case MARKETPLACE_STATES.ADD_NAME:
      await setState(ctx.supabase, ctx.profileId, {
        key: MARKETPLACE_STATES.ADD_DESC,
        data: { name: trimmed },
      });
      await sendText(
        ctx.from,
        "Optional: send a short description (or reply 'skip').",
      );
      return true;
    case MARKETPLACE_STATES.ADD_DESC:
      await setState(ctx.supabase, ctx.profileId, {
        key: MARKETPLACE_STATES.ADD_CATALOG,
        data: { ...state.data, description: trimmed },
      });
      await sendText(
        ctx.from,
        "Optional: send WhatsApp Catalog URL (or reply 'skip').",
      );
      return true;
    case MARKETPLACE_STATES.ADD_CATALOG:
      await setState(ctx.supabase, ctx.profileId, {
        key: MARKETPLACE_STATES.ADD_LOCATION,
        data: { ...state.data, catalog: trimmed },
      });
      await sendText(
        ctx.from,
        "Share your business location (tap ➕ → Location).",
      );
      return true;
    default:
      return false;
  }
}

export async function handleMarketplaceSkip(
  ctx: RouterContext,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (!ctx.profileId) return false;
  if (state.key === MARKETPLACE_STATES.ADD_DESC) {
    await setState(ctx.supabase, ctx.profileId, {
      key: MARKETPLACE_STATES.ADD_CATALOG,
      data: state.data,
    });
    await sendText(
      ctx.from,
      "Optional: send WhatsApp Catalog URL (or reply 'skip').",
    );
    return true;
  }
  if (state.key === MARKETPLACE_STATES.ADD_CATALOG) {
    await setState(ctx.supabase, ctx.profileId, {
      key: MARKETPLACE_STATES.ADD_LOCATION,
      data: state.data,
    });
    await sendText(
      ctx.from,
      "Share your business location (tap ➕ → Location).",
    );
    return true;
  }
  return false;
}

export async function handleMarketplaceLocation(
  ctx: RouterContext,
  state: { key: string; data?: Record<string, unknown> },
  coords: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId) return false;
  if (state.key === MARKETPLACE_STATES.ADD_LOCATION) {
    const rawName = String(state.data?.name ?? "").trim();
    if (!rawName) {
      await sendText(ctx.from, "Name missing. Restart marketplace flow.");
      await clearState(ctx.supabase, ctx.profileId);
      await sendHomeMenu(ctx);
      return true;
    }
    const name = rawName.slice(0, 60);
    const description = state.data?.description === undefined ||
        state.data?.description === "skip"
      ? undefined
      : String(state.data?.description);
    const catalog =
      state.data?.catalog === undefined || state.data?.catalog === "skip"
        ? undefined
        : String(state.data?.catalog);
    try {
      await createBusiness(ctx.supabase, {
        owner: ctx.from,
        name,
        description,
        catalog_url: catalog,
        lat: coords.lat,
        lng: coords.lng,
      });
      await sendText(
        ctx.from,
        "Business saved! Users nearby can discover it now.",
      );
    } catch (error) {
      console.error("marketplace.create_fail", error);
      await sendText(
        ctx.from,
        "Could not save your business right now. Try again later.",
      );
    }
    await clearState(ctx.supabase, ctx.profileId);
    await sendHomeMenu(ctx);
    return true;
  }
  if (state.key === MARKETPLACE_STATES.BROWSE_LOCATION) {
    const businesses = await listBusinesses(ctx.supabase, coords, 10);
    if (!businesses.length) {
      await sendText(ctx.from, "No businesses nearby yet.");
      await clearState(ctx.supabase, ctx.profileId);
      await sendHomeMenu(ctx);
      return true;
    }
    const rows = businesses.map((biz: any, idx: number) => ({
      id: `biz_${biz.id}`,
      title: `${(biz?.name ?? "Business").slice(0, 24)}`,
      description: `~${Math.round((biz?.distance_km ?? 0) * 10) / 10}km • ${
        biz?.location_text ?? ""
      }`,
    })).slice(0, 10);
    await setState(ctx.supabase, ctx.profileId, {
      key: MARKETPLACE_STATES.RESULTS,
      data: {
        rows: businesses.map((biz: any) => ({
          id: `biz_${biz.id}`,
          whatsapp: biz.owner_whatsapp,
          name: biz.name,
        })),
      },
    });
    await sendList(ctx.from, {
      title: "Marketplace",
      body: "Nearby businesses",
      sectionTitle: "Businesses",
      rows,
    });
    return true;
  }
  return false;
}

export async function handleMarketplaceResult(
  ctx: RouterContext,
  state: { key: string; data?: Record<string, unknown> },
  id: string,
): Promise<boolean> {
  if (state.key !== MARKETPLACE_STATES.RESULTS) return false;
  const entry = (state.data?.rows as
    | Array<{ id: string; whatsapp: string; name: string }>
    | undefined)?.find((row) => row.id === id);
  if (!entry) return false;
  await sendText(
    ctx.from,
    `Contact ${entry.name}: ${
      maskPhone(entry.whatsapp)
    }\nOpen chat: https://wa.me/${entry.whatsapp.replace(/^\+/, "")}`,
  );
  if (ctx.profileId) {
    await clearState(ctx.supabase, ctx.profileId);
  }
  await sendHomeMenu(ctx);
  return true;
}
