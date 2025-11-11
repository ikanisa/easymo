import type { RouterContext } from "../types.ts";
import { setState } from "../state/store.ts";
import { IDS } from "../wa/ids.ts";
import { maskPhone } from "./support.ts";
import { sendListMessage } from "../utils/reply.ts";
import {
  evaluateMotorInsuranceGate,
  recordMotorInsuranceHidden,
} from "../domains/insurance/gate.ts";
import { t, type TranslationKey } from "../i18n/translator.ts";

const PAGE_SIZE = 9;

type MenuRow = {
  id: string;
  title: string;
  description: string;
};

type HomeState = {
  page: number;
};

type MenuRowDef = {
  id: string;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
};

const BASE_ROW_DEFS: MenuRowDef[] = [
  {
    id: IDS.SEE_DRIVERS,
    titleKey: "home.rows.seeDrivers.title",
    descriptionKey: "home.rows.seeDrivers.description",
  },
  {
    id: IDS.SEE_PASSENGERS,
    titleKey: "home.rows.seePassengers.title",
    descriptionKey: "home.rows.seePassengers.description",
  },
  {
    id: IDS.SCHEDULE_TRIP,
    titleKey: "home.rows.scheduleTrip.title",
    descriptionKey: "home.rows.scheduleTrip.description",
  },
  {
    id: IDS.SAVED_PLACES,
    titleKey: "home.rows.savedPlaces.title",
    descriptionKey: "home.rows.savedPlaces.description",
  },
  {
    id: IDS.NEARBY_PHARMACIES,
    titleKey: "home.rows.nearbyPharmacies.title",
    descriptionKey: "home.rows.nearbyPharmacies.description",
  },
  {
    id: IDS.NEARBY_QUINCAILLERIES,
    titleKey: "home.rows.nearbyQuincailleries.title",
    descriptionKey: "home.rows.nearbyQuincailleries.description",
  },
  {
    id: IDS.MARKETPLACE,
    titleKey: "home.rows.marketplace.title",
    descriptionKey: "home.rows.marketplace.description",
  },
  {
    id: IDS.PROPERTY_RENTALS,
    titleKey: "home.rows.propertyRentals.title",
    descriptionKey: "home.rows.propertyRentals.description",
  },
  {
    id: IDS.MOMO_QR,
    titleKey: "home.rows.momoQr.title",
    descriptionKey: "home.rows.momoQr.description",
  },
  {
    id: IDS.MOTOR_INSURANCE,
    titleKey: "home.rows.motorInsurance.title",
    descriptionKey: "home.rows.motorInsurance.description",
  },
];

const ADMIN_ROW_DEF: MenuRowDef = {
  id: IDS.ADMIN_HUB,
  titleKey: "home.rows.admin.title",
  descriptionKey: "home.rows.admin.description",
};

export async function sendHomeMenu(
  ctx: RouterContext,
  page = 0,
): Promise<void> {
  const gate = await evaluateMotorInsuranceGate(ctx);
  if (!gate.allowed) {
    await recordMotorInsuranceHidden(ctx, gate, "menu");
  }
  const rows = buildRows({
    isAdmin: gate.isAdmin,
    showInsurance: gate.allowed,
    locale: ctx.locale,
  });
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const start = safePage * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE);

  const extras: MenuRow[] = [];
  if (safePage > 0) {
    extras.push({
      id: IDS.HOME_BACK,
      title: t(ctx.locale, "home.extras.back.title"),
      description: t(ctx.locale, "home.extras.back.description"),
    });
  }
  if (safePage < totalPages - 1) {
    extras.push({
      id: IDS.HOME_MORE,
      title: t(ctx.locale, "home.extras.more.title"),
      description: t(ctx.locale, "home.extras.more.description"),
    });
  }

  const visibleRows = [...pageRows, ...extras];

  if (ctx.profileId) {
    await setState(ctx.supabase, ctx.profileId, {
      key: "home_menu",
      data: { page: safePage } satisfies HomeState,
    });
  }

  const greeting = t(ctx.locale, "home.menu.greeting", {
    phone: maskPhone(ctx.from),
    current: String(safePage + 1),
    total: String(totalPages),
  });

  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, "home.menu.title"),
      body: greeting,
      sectionTitle: t(ctx.locale, "home.menu.section"),
      rows: visibleRows,
      buttonText: t(ctx.locale, "home.menu.button"),
    },
    { emoji: "✨" },
  );
}

function buildRows(options: {
  isAdmin: boolean;
  showInsurance: boolean;
  locale: RouterContext["locale"];
}): MenuRow[] {
  const baseDefs = options.showInsurance
    ? BASE_ROW_DEFS
    : BASE_ROW_DEFS.filter((row) => row.id !== IDS.MOTOR_INSURANCE);
  const localizedBase = baseDefs.map((row) => ({
    id: row.id,
    title: t(options.locale, row.titleKey),
    description: t(options.locale, row.descriptionKey),
  }));
  if (!options.isAdmin) return localizedBase;
  return [
    {
      id: ADMIN_ROW_DEF.id,
      title: t(options.locale, ADMIN_ROW_DEF.titleKey),
      description: t(options.locale, ADMIN_ROW_DEF.descriptionKey),
    },
    ...localizedBase,
  ];
}
