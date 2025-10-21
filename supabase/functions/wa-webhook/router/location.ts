import type { RouterContext } from "../types.ts";
import { handleNearbyLocation } from "../domains/mobility/nearby.ts";
import {
  handleScheduleDropoff,
  handleScheduleLocation,
} from "../domains/mobility/schedule.ts";
import { handleMarketplaceLocation } from "../domains/marketplace/index.ts";
import { handleOnboardLocationCoordinates } from "../domains/dinein/manager.ts";
import { maybeHandleDriverLocation } from "../observe/driver_parser.ts";
import { recordInbound } from "../observe/conv_audit.ts";

export async function handleLocation(
  ctx: RouterContext,
  msg: any,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (msg.type !== "location") return false;
  // Record inbound for correlation (best-effort)
  try {
    await recordInbound(ctx, msg);
  } catch (_) { /* noop */ }
  // Best-effort driver location collection (non-blocking)
  try {
    await maybeHandleDriverLocation(ctx, msg);
  } catch (_) { /* noop */ }
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
  if (state.key === "schedule_dropoff") {
    return await handleScheduleDropoff(ctx, (state.data ?? {}) as any, {
      lat,
      lng,
    });
  }
  if (
    await handleOnboardLocationCoordinates(ctx, state, {
      lat,
      lng,
      name: typeof msg.location?.name === "string" ? msg.location.name : null,
      address: typeof msg.location?.address === "string"
        ? msg.location.address
        : null,
    })
  ) {
    return true;
  }
  if (await handleMarketplaceLocation(ctx, state, { lat, lng })) {
    return true;
  }
  return false;
}
