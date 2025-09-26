import type { RouterContext } from "../../types.ts";
import { setState } from "../../state/store.ts";

export const DINE_STATE = {
  ENTRY: "dine_bars_entry",
  MENU: "dine_bars_menu",
  MANAGER_ENTRY: "dine_manager_entry",
  MANAGER_MENU: "dine_manager_menu",
  ONBOARD_IDENTITY: "dine_onboard_identity",
  ONBOARD_CONTACTS: "dine_onboard_contacts",
  ONBOARD_UPLOAD: "dine_onboard_upload",
  ONBOARD_PUBLISH: "dine_onboard_publish",
  REVIEW_LIST: "dine_review_list",
  REVIEW_ITEM_MENU: "dine_review_item_menu",
  REVIEW_EDIT_FIELD: "dine_review_edit_field",
  MANAGE_ORDERS: "dine_manage_orders",
  ADD_WHATSAPP: "dine_add_whatsapp",
} as const;

type DineStateKey = typeof DINE_STATE[keyof typeof DINE_STATE];

type StateOptions = {
  back?: DineStateKey | null;
  data?: Record<string, unknown>;
};

export async function setDineState(
  ctx: RouterContext,
  key: DineStateKey,
  options: StateOptions = {},
): Promise<void> {
  if (!ctx.profileId) return;
  await setState(ctx.supabase, ctx.profileId, {
    key,
    data: {
      ...(options.data ?? {}),
      back: options.back ?? null,
    },
  });
}

export function dineBackTarget(
  state: { key: string; data?: Record<string, unknown> },
): DineStateKey | null {
  const back = state.data?.back;
  return typeof back === "string" ? back as DineStateKey : null;
}
