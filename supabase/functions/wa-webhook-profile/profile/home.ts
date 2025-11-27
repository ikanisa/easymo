import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { sendListMessage } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { setState } from "../../_shared/wa-webhook-shared/state/store.ts";

export const PROFILE_STATE_HOME = "profile_home";

export async function startProfile(
  ctx: RouterContext,
  _state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: PROFILE_STATE_HOME,
    data: {},
  });

  const rows = [
    {
      id: "EDIT_PROFILE",
      title: "✏️ Edit Profile",
      description: "Update name, language & settings",
    },
    {
      id: IDS.WALLET_HOME,
      title: "💎 Wallet & Tokens",
      description: "View balance, transfer, redeem rewards",
    },
    {
      id: "MOMO_QR",
      title: "📱 MoMo QR Code",
      description: "Generate QR for payments",
    },
    {
      id: IDS.MY_BUSINESSES,
      title: "🏪 My Businesses",
      description: "Manage your business listings",
    },
    {
      id: IDS.MY_JOBS,
      title: "💼 My Jobs",
      description: "Manage your job postings",
    },
    {
      id: IDS.MY_PROPERTIES,
      title: "🏠 My Properties",
      description: "Manage your property listings",
    },
    {
      id: IDS.MY_VEHICLES,
      title: "🚗 My Vehicles",
      description: "Manage your registered vehicles",
    },
    {
      id: IDS.SAVED_LOCATIONS,
      title: "📍 Saved Locations",
      description: "Your favorite places",
    },
    {
      id: IDS.BACK_MENU,
      title: "← Back to Menu",
      description: "Return to main menu",
    },
  ];

  await sendListMessage(
    ctx,
    {
      title: "👤 Profile",
      body: "Manage your account, wallet, businesses, jobs, properties, vehicles and more.",
      sectionTitle: "Profile",
      buttonText: "View",
      rows,
    },
    { emoji: "👤" },
  );

  return true;
}
