import type { RouterContext } from "../../types.ts";

export type BusinessCategory = {
  id: string;
  slug: string;
  label: string;
  description?: string | null;
};

export async function listBusinessCategories(
  ctx: RouterContext,
): Promise<BusinessCategory[]> {
  const { data, error } = await ctx.supabase
    .from("business_categories")
    .select("id, slug, label, description")
    .order("label", { ascending: true })
    .limit(20);
  if (error) {
    console.error("dine.categories.fetch_error", error);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    label: row.label,
    description: row.description,
  }));
}

export function matchBusinessCategory(
  list: BusinessCategory[],
  input: string | null,
): BusinessCategory | null {
  if (!input) return null;
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;
  return list.find((category) =>
    category.slug.toLowerCase() === normalized ||
    category.label.toLowerCase() === normalized
  ) ??
    list.find((category) =>
      category.label.toLowerCase().startsWith(normalized)
    ) ??
    null;
}
