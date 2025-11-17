import type { RouterContext } from "../../types.ts";
import { setState } from "../../state/store.ts";
import { t } from "../../i18n/translator.ts";
import { sendListMessage } from "../../utils/reply.ts";
import { IDS } from "../../wa/ids.ts";

type RecentRow = { id: string; title: string; description?: string };

export async function showRecentHub(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Read the most recent activities (up to 10)
  const { data: acts } = await ctx.supabase
    .from('recent_activities')
    .select('activity_type, ref_id, details, occurred_at')
    .eq('user_id', ctx.profileId)
    .order('occurred_at', { ascending: false })
    .limit(10);

  const rows: RecentRow[] = [];

  // Bar resumes
  for (const a of acts || []) {
    const type = String((a as any).activity_type || '');
    const ref = (a as any).ref_id ? String((a as any).ref_id) : '';
    const details = (a as any).details || {};
    const barName = (details?.barName ?? '').toString();
    if ((type === 'bar_menu' || type === 'bar_detail') && ref) {
      rows.push({
        id: `bar_resume::${ref}`,
        title: t(ctx.locale, 'home.buttons.resume', { bar: barName || 'bar' }),
        description: t(ctx.locale, 'home.resume.body', { bar: barName || 'bar' }),
      });
      break; // only need the most recent bar
    }
  }

  // Property search resume (most recent)
  for (const a of acts || []) {
    const type = String((a as any).activity_type || '');
    if (type === 'property_search') {
      rows.push({
        id: 'property_resume',
        title: '🏠 Resume property search',
        description: 'Use your last criteria and current location.',
      });
      break;
    }
  }

  // Shops search resume (most recent)
  for (const a of acts || []) {
    const type = String((a as any).activity_type || '');
    const ref = (a as any).ref_id ? String((a as any).ref_id) : '';
    const details = (a as any).details || {};
    if (type === 'shops_search' && ref) {
      const tagName = (details?.tagName ?? 'Shops').toString();
      rows.push({
        id: `shops_resume::${ref}`,
        title: `🛍️ Resume: ${tagName}`,
        description: 'Find nearby businesses with your last category.',
      });
      break;
    }
  }

  // Property add resume (most recent)
  for (const a of acts || []) {
    const type = String((a as any).activity_type || '');
    if (type === 'property_add') {
      rows.push({
        id: 'property_add_resume',
        title: '🏠 Resume property posting',
        description: 'Use your last post details and current location.',
      });
      break;
    }
  }

  // Pharmacies resume (use recent location)
  for (const a of acts || []) {
    const type = String((a as any).activity_type || '');
    if (type === 'pharmacy_search') {
      rows.push({
        id: 'pharmacy_resume',
        title: '💊 Pharmacies near you',
        description: 'Open nearby pharmacies using your recent location.',
      });
      break;
    }
  }

  // Quick entries: drivers / passengers / pharmacies
  rows.push({ id: IDS.SEE_DRIVERS, title: t(ctx.locale, 'home.rows.seeDrivers.title'), description: t(ctx.locale, 'home.rows.seeDrivers.description') });
  rows.push({ id: IDS.SEE_PASSENGERS, title: t(ctx.locale, 'home.rows.seePassengers.title'), description: t(ctx.locale, 'home.rows.seePassengers.description') });
  rows.push({ id: IDS.NEARBY_PHARMACIES, title: t(ctx.locale, 'home.rows.nearbyPharmacies.title'), description: t(ctx.locale, 'home.rows.nearbyPharmacies.description') });

  if (!rows.length) {
    rows.push({ id: IDS.BACK_MENU, title: t(ctx.locale, 'common.menu_back'), description: t(ctx.locale, 'common.back_to_menu.description') });
  } else {
    rows.push({ id: IDS.BACK_MENU, title: t(ctx.locale, 'common.menu_back'), description: t(ctx.locale, 'common.back_to_menu.description') });
  }

  await setState(ctx.supabase, ctx.profileId, { key: 'recent_hub', data: {} });
  await sendListMessage(
    ctx,
    {
      title: t(ctx.locale, 'home.resume.prompt'),
      body: t(ctx.locale, 'home.resume.prompt'),
      sectionTitle: t(ctx.locale, 'home.menu.section'),
      rows,
      buttonText: t(ctx.locale, 'common.buttons.open'),
    },
    { emoji: '🕘' },
  );
  return true;
}

export async function handleRecentSelection(ctx: RouterContext, id: string): Promise<boolean> {
  if (id.startsWith('bar_resume::')) {
    const barId = id.substring('bar_resume::'.length);
    try {
      const { data: bar } = await ctx.supabase
        .from('bars')
        .select('id,name,country,slug')
        .eq('id', barId)
        .maybeSingle();
      const detail: Record<string, unknown> = {
        barId,
        barName: bar?.name || 'Bar',
        barCountry: bar?.country || null,
        barSlug: bar?.slug || null,
      };
      const { startBarMenuOrder } = await import('../bars/search.ts');
      return await startBarMenuOrder(ctx, detail);
    } catch (_err) {
      return false;
    }
  }
  if (id === 'property_resume') {
    try {
      // Load last property_search details
      const { data: acts } = await ctx.supabase
        .from('recent_activities')
        .select('details')
        .eq('user_id', ctx.profileId!)
        .eq('activity_type', 'property_search')
        .order('occurred_at', { ascending: false })
        .limit(1);
      const details = (Array.isArray(acts) && acts[0]?.details) ? acts[0].details as any : null;
      if (!details) return false;
      const { getRecentLocation } = await import('../locations/recent.ts');
      const recent = await getRecentLocation(ctx, 'property');
      if (!recent) return false;
      const { handleFindPropertyLocation } = await import('../property/rentals.ts');
      return await handleFindPropertyLocation(ctx, details, recent);
    } catch (_err) {
      return false;
    }
  }
  if (id === 'property_add_resume') {
    try {
      // Load last property_add details
      const { data: acts } = await ctx.supabase
        .from('recent_activities')
        .select('details')
        .eq('user_id', ctx.profileId!)
        .eq('activity_type', 'property_add')
        .order('occurred_at', { ascending: false })
        .limit(1);
      const details = (Array.isArray(acts) && acts[0]?.details) ? acts[0].details as any : null;
      if (!details) return false;
      const { getRecentLocation } = await import('../locations/recent.ts');
      const recent = await getRecentLocation(ctx, 'property');
      if (!recent) return false;
      const { handleAddPropertyLocation } = await import('../property/rentals.ts');
      return await handleAddPropertyLocation(ctx, details, recent);
    } catch (_err) {
      return false;
    }
  }
  if (id === 'pharmacy_resume') {
    try {
      const { getRecentLocation } = await import('../locations/recent.ts');
      const recent = await getRecentLocation(ctx, 'pharmacies');
      if (!recent) return false;
      const { processPharmacyRequest } = await import('../healthcare/pharmacies.ts');
      return await processPharmacyRequest(ctx, recent, '');
    } catch (_err) {
      return false;
    }
  }
  if (id.startsWith('shops_resume::')) {
    const tagId = id.substring('shops_resume::'.length);
    try {
      const { getRecentLocation } = await import('../locations/recent.ts');
      const recent = await getRecentLocation(ctx, 'shops');
      if (!recent) return false;
      // Load tag name/icon from last activity
      const { data: acts } = await ctx.supabase
        .from('recent_activities')
        .select('details')
        .eq('user_id', ctx.profileId!)
        .eq('activity_type', 'shops_search')
        .eq('ref_id', tagId)
        .order('occurred_at', { ascending: false })
        .limit(1);
      const details = (Array.isArray(acts) && acts[0]?.details) ? acts[0].details as any : {};
      const { handleShopsLocation } = await import('../shops/services.ts');
      return await handleShopsLocation(ctx, {
        tag_id: tagId,
        tag_name: details?.tagName ?? undefined,
        tag_icon: details?.tagIcon ?? undefined,
        page: 0,
      }, recent);
    } catch (_err) {
      return false;
    }
  }
  if (id === IDS.SEE_DRIVERS || id === IDS.SEE_PASSENGERS) {
    const { handleSeeDrivers, handleSeePassengers } = await import('../mobility/nearby.ts');
    return id === IDS.SEE_DRIVERS
      ? await handleSeeDrivers(ctx)
      : await handleSeePassengers(ctx);
  }
  if (id === IDS.NEARBY_PHARMACIES) {
    const { startNearbyPharmacies } = await import('../healthcare/pharmacies.ts');
    return await startNearbyPharmacies(ctx);
  }
  return false;
}
