import type { RouterContext } from "../types.ts";
import { setState } from "../state/store.ts";
import { IDS } from "../wa/ids.ts";
import { maskPhone } from "./support.ts";
import { sendListMessage } from "../utils/reply.ts";
import {
  evaluateMotorInsuranceGate,
  recordMotorInsuranceHidden,
} from "../domains/insurance/gate.ts";

const PAGE_SIZE = 9;

type MenuRow = {
  id: string;
  title: string;
  description: string;
};

type HomeState = {
  page: number;
};

const BASE_ROWS: MenuRow[] = [
  {
    id: IDS.SEE_DRIVERS,
    title: "🚖 Nearby Drivers",
    description: "Find moto and cab partners close to you.",
  },
  {
    id: IDS.SEE_PASSENGERS,
    title: "🧍‍♀️ Nearby Passengers",
    description: "See riders nearby looking for a driver.",
  },
  {
    id: IDS.SCHEDULE_TRIP,
    title: "🛵 Schedule Trip",
    description: "Plan a future pickup for trusted drivers.",
  },
  {
    id: IDS.MARKETPLACE,
    title: "🛍️ Marketplace",
    description: "Discover local sellers or list your business.",
  },
  {
    id: IDS.BASKETS,
    title: "🪣 Baskets",
    description: "Create or join a saving basket with friends.",
  },
  {
    id: IDS.MOTOR_INSURANCE,
    title: "🛡️ Motor Insurance",
    description: "Upload documents and request insurance cover.",
  },
  {
    id: IDS.MOMO_QR,
    title: "💳 MoMo QR",
    description: "Generate or scan MoMo QR codes instantly.",
  },
  {
    id: IDS.WALLET,
    title: "💎 Wallet & Tokens",
    description: "Check rewards, redeem tokens, and track history.",
  },
  {
    id: IDS.DINEIN_BARS,
    title: "🍽️ Bars & Restaurants",
    description: "Order from partner bars with one tap.",
  },
];

const ADMIN_ROW: MenuRow = {
  id: IDS.ADMIN_HUB,
  title: "🛠️ Admin",
  description: "Open the operations hub for staff tools.",
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
  });
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const start = safePage * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE);

  const extras: MenuRow[] = [];
  if (safePage > 0) {
    extras.push({
      id: IDS.HOME_BACK,
      title: "◀ Back",
      description: "See the previous services.",
    });
  }
  if (safePage < totalPages - 1) {
    extras.push({
      id: IDS.HOME_MORE,
      title: "➡️ More services",
      description: "View additional easyMO services.",
    });
  }

  const visibleRows = [...pageRows, ...extras];

  if (ctx.profileId) {
    await setState(ctx.supabase, ctx.profileId, {
      key: "home_menu",
      data: { page: safePage } satisfies HomeState,
    });
  }

  const greeting = `Hello 👋 ${maskPhone(ctx.from)}\nPage ${
    safePage + 1
  }/${totalPages}`;

  await sendListMessage(
    ctx,
    {
      title: "easyMO Services",
      body: greeting,
      sectionTitle: "Quick actions",
      rows: visibleRows,
      buttonText: "Open",
    },
    { emoji: "✨" },
  );
}

function buildRows(
  options: { isAdmin: boolean; showInsurance: boolean },
): MenuRow[] {
  const filteredBase = options.showInsurance
    ? [...BASE_ROWS]
    : BASE_ROWS.filter((row) => row.id !== IDS.MOTOR_INSURANCE);
  if (options.isAdmin) return [ADMIN_ROW, ...filteredBase];
  return filteredBase;
}
