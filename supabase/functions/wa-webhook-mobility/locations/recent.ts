import type { RouterContext } from "../types.ts";

const TTL_MINUTES = 30;

export type RecentSource =
  | 'bars' | 'pharmacies' | 'quincailleries' | 'shops'
  | 'notary' | 'property' | 'marketplace' | 'mobility';

export async function saveRecentLocation(
  ctx: RouterContext,
  coords: { lat: number; lng: number },
  source?: RecentSource,
  context: Record<string, unknown> = {},
): Promise<void> {
  if (!ctx.profileId) return;
  const expires = new Date(Date.now() + TTL_MINUTES * 60 * 1000).toISOString();
  try {
    await ctx.supabase.from('recent_locations').insert({
      user_id: ctx.profileId,
      source: source ?? null,
      lat: coords.lat,
      lng: coords.lng,
      expires_at: expires,
      context,
    });
  } catch (err) {
    console.error('recent_locations.insert_fail', err);
  }
}

export async function getRecentLocation(
  ctx: RouterContext,
  preferred?: RecentSource,
): Promise<{ lat: number; lng: number } | null> {
  if (!ctx.profileId) return null;
  let query = ctx.supabase
    .from('recent_locations')
    .select('lat,lng,source,captured_at,expires_at')
    .eq('user_id', ctx.profileId)
    .gt('expires_at', new Date().toISOString())
    .order('captured_at', { ascending: false })
    .limit(1);
  if (preferred) {
    query = query.eq('source', preferred);
  }
  try {
    const { data } = await query;
    if (data && data.length) {
      return { lat: data[0].lat as number, lng: data[0].lng as number };
    }
  } catch (err) {
    console.error('recent_locations.query_fail', err);
  }
  return null;
}

export async function recordRecentActivity(
  ctx: RouterContext,
  activityType: string,
  refId?: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  if (!ctx.profileId) return;
  try {
    await ctx.supabase.from('recent_activities').insert({
      user_id: ctx.profileId,
      activity_type: activityType,
      ref_id: refId ?? null,
      details,
    });
  } catch (err) {
    console.error('recent_activities.insert_fail', err);
  }
}

