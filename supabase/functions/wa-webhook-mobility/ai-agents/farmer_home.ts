import type { RouterContext } from "../types.ts";
import { sendButtonsMessage } from "../utils/reply.ts";
import { IDS } from "../wa/ids.ts";
import { setState } from "../state/store.ts";
import { t } from "../i18n/translator.ts";

export async function startFarmerAgentMenu(ctx: RouterContext): Promise<void> {
  const welcomeMsg = t(ctx.locale, "farmer.welcome");
  const menuText = `${welcomeMsg}\n\n1️⃣ ${t(ctx.locale, "farmer.supply.title")}\n2️⃣ ${t(ctx.locale, "farmer.demand.title")}\n0️⃣ ${t(ctx.locale, "common.back")}`;

  if (ctx.profileId) {
    await setState(ctx.supabase, ctx.profileId, {
      key: "farmer_agent_menu",
      data: {},
    });
  }

  const { sendText } = await import("../wa/client.ts");
  await sendText(ctx.from, menuText);
}

export async function handleFarmerAgentSupply(ctx: RouterContext): Promise<void> {
  if (ctx.profileId) {
    await setState(ctx.supabase, ctx.profileId, {
      key: "ai_farmer_broker",
      data: { intent: "farmer_supply" },
    });
  }

  const { sendText } = await import("../wa/client.ts");
  await sendText(ctx.from, t(ctx.locale, "farmer.supply.prompt"));
}

export async function handleFarmerAgentDemand(ctx: RouterContext): Promise<void> {
  if (ctx.profileId) {
    await setState(ctx.supabase, ctx.profileId, {
      key: "ai_farmer_broker",
      data: { intent: "buyer_demand" },
    });
  }

  const { sendText } = await import("../wa/client.ts");
  await sendText(ctx.from, t(ctx.locale, "farmer.demand.prompt"));
}
