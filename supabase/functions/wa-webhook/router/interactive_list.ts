import type { RouterContext } from "../types.ts";
import {
  handleNearbyResultSelection,
  handleVehicleSelection,
  isVehicleOption,
} from "../flows/mobility/nearby.ts";
import {
  handleScheduleResultSelection,
  handleScheduleRole,
  handleScheduleVehicle,
  isScheduleResult,
  isScheduleRole,
} from "../flows/mobility/schedule.ts";
import { handleBasketListSelection } from "../flows/baskets.ts";
import { handleMarketplaceResult } from "../flows/marketplace.ts";
import { handleWalletEarnSelection } from "../flows/wallet/earn.ts";
import { handleWalletRedeemSelection } from "../flows/wallet/redeem.ts";
import { ADMIN_ROW_IDS } from "../flows/admin/hub.ts";
import { handleAdminRow } from "../flows/admin/dispatcher.ts";

export async function handleList(
  ctx: RouterContext,
  msg: any,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  const id = msg.interactive?.list_reply?.id;
  if (!id) return false;
  if (isVehicleOption(id) && state.key === "mobility_nearby_select") {
    return await handleVehicleSelection(ctx, (state.data ?? {}) as any, id);
  }
  if (state.key === "mobility_nearby_results") {
    return await handleNearbyResultSelection(
      ctx,
      (state.data ?? {}) as any,
      id,
    );
  }
  if (isScheduleRole(id) && state.key === "schedule_role") {
    return await handleScheduleRole(ctx, id);
  }
  if (isVehicleOption(id) && state.key === "schedule_vehicle") {
    return await handleScheduleVehicle(ctx, (state.data ?? {}) as any, id);
  }
  if (isScheduleResult(id) && state.key === "schedule_results") {
    return await handleScheduleResultSelection(
      ctx,
      (state.data ?? {}) as any,
      id,
    );
  }
  if (await handleBasketListSelection(ctx, id, state)) {
    return true;
  }
  if (await handleMarketplaceResult(ctx, state, id)) {
    return true;
  }
  if (await handleWalletEarnSelection(ctx, state as any, id)) {
    return true;
  }
  if (await handleWalletRedeemSelection(ctx, state as any, id)) {
    return true;
  }
  if (id.startsWith("ADMIN::")) {
    if (
      id === ADMIN_ROW_IDS.OPS_TRIPS || id === ADMIN_ROW_IDS.OPS_BASKETS ||
      id === ADMIN_ROW_IDS.OPS_INSURANCE ||
      id === ADMIN_ROW_IDS.OPS_MARKETPLACE || id === ADMIN_ROW_IDS.OPS_WALLET ||
      id === ADMIN_ROW_IDS.OPS_MOMO || id === ADMIN_ROW_IDS.GROW_PROMOTERS ||
      id === ADMIN_ROW_IDS.GROW_BROADCAST ||
      id === ADMIN_ROW_IDS.GROW_TEMPLATES ||
      id === ADMIN_ROW_IDS.TRUST_REFERRALS ||
      id === ADMIN_ROW_IDS.TRUST_FREEZE || id === ADMIN_ROW_IDS.DIAG_MATCH ||
      id === ADMIN_ROW_IDS.DIAG_INSURANCE || id === ADMIN_ROW_IDS.DIAG_HEALTH ||
      id === ADMIN_ROW_IDS.DIAG_LOGS
    ) {
      return await handleAdminRow(ctx, id);
    }
  }
  return false;
}
