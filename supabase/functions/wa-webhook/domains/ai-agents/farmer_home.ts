import { t } from "../../i18n/translator.ts";
import { setState } from "../../state/store.ts";
import type { RouterContext } from "../../types.ts";
import { sendButtonsMessage } from "../../utils/reply.ts";
import { IDS } from "../../wa/ids.ts";

export async function startFarmerAgentMenu(ctx: RouterContext): Promise<void> {
  if (ctx.profileId) {
    await setState(ctx.supabase, ctx.profileId, {
      key: "farmer_agent_menu",
      data: {},
    });
  }

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "farmer.welcome"),
    [
      { id: IDS.FARMER_AGENT_SUPPLY, title: t(ctx.locale, "farmer.supply.title") },
      { id: IDS.FARMER_AGENT_DEMAND, title: t(ctx.locale, "farmer.demand.title") },
    ]
  );
}

export async function handleFarmerAgentSupply(ctx: RouterContext): Promise<void> {
  if (ctx.profileId) {
    await setState(ctx.supabase, ctx.profileId, {
      key: "ai_farmer_broker",
      data: { intent: "farmer_supply" },
    });
  }

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "farmer.supply.prompt"),
    [{ id: IDS.BACK_HOME, title: t(ctx.locale, "common.home_button") }]
  );
}

export async function handleFarmerAgentDemand(ctx: RouterContext): Promise<void> {
  if (ctx.profileId) {
    await setState(ctx.supabase, ctx.profileId, {
      key: "ai_farmer_broker",
      data: { intent: "buyer_demand" },
    });
  }

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "farmer.demand.prompt"),
    [{ id: IDS.BACK_HOME, title: t(ctx.locale, "common.home_button") }]
  );
}
