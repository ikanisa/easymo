import type { SupabaseClient } from "../../deps.ts";

export type MarketplaceCategoryDef = {
  id: string;
  value: string;
  title: string;
  description: string;
  icon: string;
  keywords: string[];
  visible: boolean;
  order?: number;
  legacyValues?: string[];
};

const CATEGORY_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedCategories: {
  defs: MarketplaceCategoryDef[];
  expiresAt: number;
} | null = null;

const FALLBACK_CATEGORY_DEFS: MarketplaceCategoryDef[] = [
  {
    id: "cat::pharmacies",
    value: "pharmacies",
    title: "💊 Pharmacies",
    description: "Trusted medicine & wellness.",
    icon: "💊",
    keywords: ["pharmacy", "pharmacies", "medicine", "drugstore"],
    visible: true,
    legacyValues: ["pharmacy"],
  },
  {
    id: "cat::quincailleries",
    value: "quincailleries",
    title: "🛠️ Quincailleries",
    description: "Hardware & building supplies.",
    icon: "🛠️",
    keywords: ["hardware", "quincaillerie", "tools", "building"],
    visible: true,
  },
  {
    id: "cat::auto_spareparts",
    value: "auto_spareparts",
    title: "🚗 Auto Spareparts",
    description: "Parts & garages for vehicles.",
    icon: "🚗",
    keywords: ["auto", "spareparts", "car parts", "garage"],
    visible: true,
  },
  {
    id: "cat::shops",
    value: "shops",
    title: "🛍️ Shops",
    description: "Everyday shops for essentials.",
    icon: "🛍️",
    keywords: ["shop", "shops", "store", "boutique", "groceries", "grocery"],
    visible: true,
    legacyValues: ["groceries"],
  },
  {
    id: "cat::saloons",
    value: "saloons",
    title: "💈 Saloons",
    description: "Beauty and grooming services.",
    icon: "💈",
    keywords: ["saloon", "salon", "beauty", "barber"],
    visible: true,
  },
  {
    id: "cat::mobile_money_agents",
    value: "mobile_money_agents",
    title: "💵 Mobile Money",
    description: "Send, receive & cash-out here.",
    icon: "💵",
    keywords: ["mobile money", "agent", "momo", "cash"],
    visible: true,
  },
  {
    id: "cat::cars_rental_sale",
    value: "cars_rental_sale",
    title: "🚘 Cars Rental/Sale",
    description: "Hire or buy cars nearby.",
    icon: "🚘",
    keywords: ["car", "cars", "rental", "sale", "vehicle"],
    visible: true,
    legacyValues: ["cars (rental/sales)", "cars rental/sales"],
  },
  {
    id: "cat::houses_rental_sale",
    value: "houses_rental_sale",
    title: "🏠 Houses Rental/Sale",
    description: "Find homes to rent or buy.",
    icon: "🏠",
    keywords: ["house", "home", "rental", "sale", "real estate"],
    visible: true,
    legacyValues: ["properties (rentals/sales)", "properties rentals/sales"],
  },
  // Legacy categories retained for backwards compatibility but hidden from menus.
  {
    id: "cat::pharmacy",
    value: "pharmacy",
    title: "💊 Pharmacy",
    description: "Legacy pharmacy category.",
    icon: "💊",
    keywords: ["pharmacy", "pharmacies"],
    visible: false,
  },
  {
    id: "cat::groceries",
    value: "groceries",
    title: "🛒 Groceries",
    description: "Legacy groceries category.",
    icon: "🛒",
    keywords: ["groceries", "grocery", "food"],
    visible: false,
  },
  {
    id: "cat::services",
    value: "services",
    title: "🛠️ Services",
    description: "Legacy services category.",
    icon: "🛠️",
    keywords: ["services", "service"],
    visible: false,
  },
  {
    id: "cat::fashion",
    value: "fashion",
    title: "👗 Fashion",
    description: "Legacy fashion category.",
    icon: "👗",
    keywords: ["fashion", "clothes"],
    visible: false,
  },
  {
    id: "cat::other",
    value: "other",
    title: "➕ Other",
    description: "Legacy catch-all category.",
    icon: "➕",
    keywords: ["other", "misc", "general"],
    visible: false,
  },
];

function buildDefFromRow(row: {
  slug: string | null;
  name: string | null;
  description: string | null;
  icon: string | null;
  is_visible?: boolean | null;
  is_active?: boolean | null;
  sort_order?: number | null;
}): MarketplaceCategoryDef {
  const slug = (row.slug ?? row.name ?? "").toLowerCase().replace(
    /[^a-z0-9]+/g,
    "_",
  ).replace(/^_+|_+$/g, "");
  const name = row.name?.trim() || titleCase(slug.replace(/_/g, " "));
  const icon = row.icon?.trim() && row.icon.trim().length
    ? row.icon.trim()
    : "🏷️";
  const description = row.description?.trim() || "";
  const keywords = Array.from(
    new Set([
      slug,
      slug.replace(/_/g, " "),
      name.toLowerCase(),
    ]),
  ).filter((item) => item.length > 0);

  return {
    id: `cat::${slug}`,
    value: slug,
    title: `${icon} ${name}`.trim(),
    description,
    icon,
    keywords,
    visible: (row.is_visible ?? true) && (row.is_active ?? true),
    order: row.sort_order ?? undefined,
  };
}

function titleCase(input: string): string {
  return input.split(/\s+/).map((part) => {
    if (!part.length) return part;
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join(" ");
}

export async function getMarketplaceCategoryDefs(
  client: SupabaseClient,
): Promise<MarketplaceCategoryDef[]> {
  const now = Date.now();
  if (cachedCategories && cachedCategories.expiresAt > now) {
    return cachedCategories.defs;
  }

  try {
    const { data, error } = await client
      .from("marketplace_categories")
      .select("slug, name, description, icon, sort_order, is_active")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;

    if (data && data.length) {
      const defs = data.map((row) => buildDefFromRow(row));
      const hiddenLegacy = FALLBACK_CATEGORY_DEFS.filter((def) => !def.visible);
      cachedCategories = {
        defs: [...defs, ...hiddenLegacy],
        expiresAt: now + CATEGORY_CACHE_TTL_MS,
      };
      return cachedCategories.defs;
    }
  } catch (err) {
    console.error("marketplace.categories_fetch_fail", err);
  }

  cachedCategories = {
    defs: [...FALLBACK_CATEGORY_DEFS],
    expiresAt: now + CATEGORY_CACHE_TTL_MS,
  };
  return cachedCategories.defs;
}

export function buildCategoryRows(
  defs: MarketplaceCategoryDef[],
): Array<{ id: string; title: string; description?: string }> {
  return defs
    .filter((def) => def.visible)
    .map((def) => ({
      id: def.id,
      title: def.title,
      description: def.description,
    }));
}

export function findCategoryById(
  defs: MarketplaceCategoryDef[],
  id: string,
): MarketplaceCategoryDef | undefined {
  return defs.find((def) => def.id === id);
}

export function findCategoryBySlug(
  defs: MarketplaceCategoryDef[],
  slug: string | null | undefined,
): MarketplaceCategoryDef | undefined {
  if (!slug) return undefined;
  const lower = slug.toLowerCase();
  return defs.find((def) => def.value === lower);
}

export function normalizeMarketplaceCategoryInput(
  defs: MarketplaceCategoryDef[],
  raw: string,
): string | null {
  const lower = raw.trim().toLowerCase();
  if (!lower) return null;

  for (const def of defs) {
    if (def.value === lower || def.id === lower) {
      return def.value;
    }
    if (def.keywords.some((keyword) => keyword === lower)) {
      return def.value;
    }
    if (def.legacyValues?.some((legacy) => legacy.toLowerCase() === lower)) {
      return def.value;
    }
    const titleText = def.title.replace(/^[^a-z0-9]+/i, "").toLowerCase();
    if (titleText.includes(lower)) {
      return def.value;
    }
  }
  return null;
}

export function getMarketplaceCategoryLabel(
  defs: MarketplaceCategoryDef[],
  category: string | null | undefined,
): string {
  if (!category || !category.length) return "Other";
  const match = findCategoryBySlug(defs, category);
  if (match) {
    const withoutIcon = match.title.replace(/^[^\p{L}\p{N}]+/u, "").trim();
    return withoutIcon.length ? withoutIcon : match.title;
  }
  const legacy = defs.find((def) =>
    def.legacyValues?.some((legacyValue) =>
      legacyValue.toLowerCase() === category.toLowerCase()
    )
  );
  if (legacy) {
    const withoutIcon = legacy.title.replace(/^[^\p{L}\p{N}]+/u, "").trim();
    return withoutIcon.length ? withoutIcon : legacy.title;
  }
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function resetMarketplaceCategoryCache(): void {
  cachedCategories = null;
}
