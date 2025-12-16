import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { sendListMessage } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { setState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

export const PROFILE_STATE_HOME = "profile_home";

/**
 * Simplified Profile Menu Items
 * Only QR Code and Wallet
 */
const PROFILE_MENU_ITEMS = [
  {
    id: IDS.MOMO_QR,
    icon: "📱",
    title: "MoMo QR Code",
    description: "Your payment QR code",
  },
  {
    id: "WALLET",
    icon: "💳",
    title: "Wallet & Tokens",
    description: "Balance, earn, and transfer",
  },
  {
    id: IDS.BACK_MENU,
    icon: "←",
    title: "Back to Menu",
    description: "",
  },
];

/**
 * Display the profile menu
 */
export async function startProfile(
  ctx: RouterContext,
  _state?: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: PROFILE_STATE_HOME,
    data: {},
  });

  // Log menu display for analytics
  await logStructuredEvent("PROFILE_MENU_DISPLAYED", {
    userId: ctx.profileId,
    itemCount: PROFILE_MENU_ITEMS.length,
    locale: ctx.locale,
  });

  // Convert to list message format
  const rows = PROFILE_MENU_ITEMS.map((item) => ({
    id: item.id,
    title: `${item.icon} ${item.title}`,
    description: item.description,
  }));

  await sendListMessage(
    ctx,
    {
      title: "👤 Profile",
      body: "Manage your QR code and wallet tokens.",
      sectionTitle: "Profile",
      buttonText: "View",
      rows,
    },
    { emoji: "👤" },
  );

  return true;
}
