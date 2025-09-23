import type { RouterContext } from "../types.ts";
import { handleNearbyLocation } from "../flows/mobility/nearby.ts";
import { handleScheduleLocation } from "../flows/mobility/schedule.ts";
import { handleBasketLocation } from "../flows/baskets.ts";
import { handleMarketplaceLocation } from "../flows/marketplace.ts";

export async function handleLocation(
  ctx: RouterContext,
  msg: any,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (msg.type !== "location") return false;
  const lat = parseFloat(msg.location?.latitude ?? "0");
  const lng = parseFloat(msg.location?.longitude ?? "0");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (state.key === "mobility_nearby_location") {
    return await handleNearbyLocation(ctx, (state.data ?? {}) as any, {
      lat,
      lng,
    });
  }
  if (state.key === "schedule_location") {
    return await handleScheduleLocation(ctx, (state.data ?? {}) as any, {
      lat,
      lng,
    });
  }
  if (await handleMarketplaceLocation(ctx, state, { lat, lng })) {
    return true;
  }
  if (await handleBasketLocation(ctx, state, { lat, lng })) {
    return true;
  }
  return false;
}
