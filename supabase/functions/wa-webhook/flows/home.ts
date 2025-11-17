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
  const rows = await buildRows({
    isAdmin: gate.isAdmin,
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
  isAdmin: boolean;
  showInsurance: boolean;
  locale: RouterContext["locale"];
  ctx: RouterContext;
}): Promise<MenuRow[]> {
  // Extract country code from E.164 phone number (e.g., +250... -> RW)
  const countryCode = getCountryFromPhone(options.ctx.from);
  
  // Fetch dynamic menu items from database
  const menuItems = await fetchActiveMenuItems(countryCode, options.ctx.supabase);
  
  // Build menu rows from dynamic items
  const dynamicRows: MenuRow[] = menuItems.map((item) => {
    const { titleKey, descriptionKey } = getMenuItemTranslationKeys(item.key);
    return {
      id: getMenuItemId(item.key),
      title: t(options.locale, titleKey as TranslationKey),
      description: t(options.locale, descriptionKey as TranslationKey),
    };
  });

  // Recent resume row (e.g., last bar menu)
  try {
    if (options.ctx.profileId) {
      const { data: recent } = await options.ctx.supabase
        .from('recent_activities')
        .select('activity_type, ref_id, details')
        .eq('user_id', options.ctx.profileId)
        .order('occurred_at', { ascending: false })
        .limit(1);
      const last = Array.isArray(recent) && recent[0] ? recent[0] as any : null;
      if (last && (last.activity_type === 'bar_menu' || last.activity_type === 'bar_detail')) {
        const barId = String(last.ref_id || (last.details?.barId ?? ''));
        const barName = String(last.details?.barName || '').trim() || 'your last bar';
        if (barId) {
          dynamicRows.unshift({
            id: `bar_resume::${barId}`,
            title: t(options.locale, 'home.buttons.resume' as TranslationKey, { bar: barName }),
            description: t(options.locale, 'home.resume.body' as TranslationKey, { bar: barName }),
          });
        }
      }
    }
  } catch (_) { /* non-fatal */ }
  
  // Filter motor insurance if not allowed
  const filteredRows = options.showInsurance
    ? dynamicRows
    : dynamicRows.filter((row) => row.id !== IDS.MOTOR_INSURANCE);
  
  // Add admin row if user is admin
  if (!options.isAdmin) return filteredRows;
  return [
    {
      id: ADMIN_ROW_DEF.id,
      title: t(options.locale, ADMIN_ROW_DEF.titleKey),
      description: t(options.locale, ADMIN_ROW_DEF.descriptionKey),
    },
    ...filteredRows,
  ];
}

function getCountryFromPhone(phone: string): string {
  // Map common country codes for East Africa
  const countryMap: Record<string, string> = {
    "250": "RW", // Rwanda
    "256": "UG", // Uganda
    "254": "KE", // Kenya
    "255": "TZ", // Tanzania
    "257": "BI", // Burundi
    "243": "CD", // DR Congo
  };
  
  // Extract prefix from E.164 format (+250... or 250...)
  const cleanPhone = phone.replace(/^\+/, "");
  for (const [prefix, country] of Object.entries(countryMap)) {
    if (cleanPhone.startsWith(prefix)) {
      return country;
    }
  }
  
  // Default to Rwanda
  return "RW";
}
