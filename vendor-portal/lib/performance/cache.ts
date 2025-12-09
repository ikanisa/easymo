import { unstable_cache } from "next/cache";

export const REVALIDATION_SECONDS = {
  minute: 60,
  fiveMinutes: 300,
  fifteenMinutes: 900,
} as const;

export const CACHE_TAGS = {
  dashboardSummary: "dashboard:summary",
  ikiminaDirectory: "ikimina:directory",
  sacco: (id: string | null) => (id ? `sacco:${id}` : "sacco:all"),
  ikimina: (id: string) => `ikimina:${id}`,
  analyticsExecutive: (saccoId: string | null) =>
    saccoId ? `analytics:executive:${saccoId}` : "analytics:executive:all",
} as const;

export function composeTags(...tags: Array<string | false | null | undefined>): string[] {
  return Array.from(new Set(tags.filter(Boolean) as string[]));
}

export function cacheWithTags<TResult>(
  fn: () => Promise<TResult>,
  keyParts: Array<string | number | boolean | null | undefined>,
  tags: Array<string | false | null | undefined>,
  revalidate: number | undefined = REVALIDATION_SECONDS.fiveMinutes
) {
  const key = keyParts.map((part) => String(part ?? "∅"));
  const normalizedTags = composeTags(...tags);
  return unstable_cache(fn, key, { tags: normalizedTags, revalidate });
}
