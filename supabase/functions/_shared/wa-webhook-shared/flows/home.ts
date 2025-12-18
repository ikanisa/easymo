import type { RouterContext } from "../types.ts";
import { setState } from "../state/store.ts";
import { IDS } from "../wa/ids.ts";
import { maskPhone } from "./support.ts";
import { sendListMessage } from "../utils/reply.ts";
import { t, type TranslationKey } from "../i18n/translator.ts";
import {
  fetchActiveMenuItems,
  getMenuItemId,
  getMenuItemTranslationKeys,
} from "../domains/menu/dynamic_home_menu.ts";

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

export async function sendHomeMenu(
  ctx: RouterContext,
  page = 0,
): Promise<void> {
  // Gate functionality temporarily disabled - showing all menu items
  const gate = { allowed: true };
  const rows = await buildRows({
    showInsurance: gate.allowed,
    locale: ctx.locale,
    ctx,
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

  // Ensure unique row IDs by checking for duplicates
  const seenIds = new Set<string>();
  const uniqueRows: MenuRow[] = [];
  
  for (const row of [...pageRows, ...extras]) {
    if (!seenIds.has(row.id)) {
      seenIds.add(row.id);
      uniqueRows.push(row);
    }
  }

  if (ctx.profileId) {
    await setState(ctx.supabase, ctx.profileId, {
      key: "home_menu",
      data: { page: safePage } satisfies HomeState,
    });
  }
  
  const visibleRows = uniqueRows;

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

async function buildRows(options: {
  showInsurance: boolean;
  locale: RouterContext["locale"];
  ctx: RouterContext;
}): Promise<MenuRow[]> {
  // Fetch dynamic menu items from database (Rwanda-only, no country filtering)
  const menuItems = await fetchActiveMenuItems(options.ctx.supabase);
  
  // Build menu rows from dynamic items
  const dynamicRows: MenuRow[] = menuItems.map((item) => {
    // Use database name + icon instead of hardcoded translations
    const displayName = item.icon ? `${item.icon} ${item.name}` : item.name;
    // Use catchy description from database, fallback to translation key if not set
    const description = (item as any).description || t(options.locale, getMenuItemTranslationKeys(item.key).descriptionKey as TranslationKey);
    return {
      id: getMenuItemId(item.key),
      title: displayName,  // Display name from database
      description: description,  // Catchy description from database
    };
  });

  // Recent resume rows removed - features deleted (bars, properties, pharmacies)
  
  // Filter motor insurance if not allowed
  const filteredRows = options.showInsurance
    ? dynamicRows
    : dynamicRows.filter((row) => row.id !== IDS.MOTOR_INSURANCE);
  
  return filteredRows;
}

// Country detection removed - system is Rwanda-only
