import type { RouterContext } from "../../types.ts";
import { IDS } from "../../wa/ids.ts";
import { t } from "../../i18n/translator.ts";
import { sendListMessage } from "../../utils/reply.ts";
import { logStructuredEvent } from "../../observe/log.ts";

/**
 * Display the Rides submenu with 3 options:
 * - Nearby Drivers
 * - Nearby Passengers  
 * - Schedule Trip
 */
export async function showRidesMenu(ctx: RouterContext): Promise<boolean> {
  await logStructuredEvent("RIDES_MENU_OPENED", {
    from: ctx.from,
    profileId: ctx.profileId,
  });

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "rides.menu.title"),
      body: t(ctx.locale, "rides.menu.body"),
      sectionTitle: t(ctx.locale, "rides.menu.section"),
      rows: [
        {
          id: IDS.SEE_DRIVERS,
          title: t(ctx.locale, "home.rows.seeDrivers.title"),
          description: t(ctx.locale, "home.rows.seeDrivers.description"),
        },
        {
          id: IDS.SEE_PASSENGERS,
          title: t(ctx.locale, "home.rows.seePassengers.title"),
          description: t(ctx.locale, "home.rows.seePassengers.description"),
        },
        {
          id: IDS.SCHEDULE_TRIP,
          title: t(ctx.locale, "home.rows.scheduleTrip.title"),
          description: t(ctx.locale, "home.rows.scheduleTrip.description"),
        },
        {
          id: IDS.SCHEDULE_RECENT,
          title: "🔁 Recent scheduled trip",
          description: "Reuse your last schedule preferences",
        },
        {
          id: IDS.NEARBY_RECENT,
          title: "🔁 Recent nearby search",
          description: "Run your last search using cached location",
        },
        {
          id: "driver_go_online",
          title: "🟢 Go Online (Driver)",
          description: "Share location to get requests",
        },
        {
          id: IDS.DRIVER_GO_OFFLINE,
          title: "🔴 Go Offline (Driver)",
          description: "Stop receiving ride requests",
        },
        {
          id: IDS.BACK_MENU,
          title: t(ctx.locale, "common.menu_back"),
          description: t(ctx.locale, "common.back_to_menu.description"),
        },
      ],
      buttonText: t(ctx.locale, "common.buttons.choose"),
    },
    { emoji: "🚗" },
  );

  return true;
}
