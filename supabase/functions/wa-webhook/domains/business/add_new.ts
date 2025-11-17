import type { RouterContext } from "../../types.ts";
import { sendButtonsMessage, sendListMessage, homeOnly } from "../../utils/reply.ts";
import { IDS } from "../../wa/ids.ts";
import { setState, clearState } from "../../state/store.ts";
import { logStructuredEvent } from "../../observe/log.ts";
import { t } from "../../i18n/translator.ts";

export type AddNewBusinessState = {
  stage: 'name' | 'location' | 'category' | 'confirm';
  name?: string;
  location?: string;
  category?: string;
};

const CATEGORY_DEFS: Record<string, { key: string; tag: string }> = {
  pharmacy: { key: "business.add_new.category.pharmacy", tag: "Pharmacy" },
  quincaillerie: {
    key: "business.add_new.category.quincaillerie",
    tag: "Quincaillerie",
  },
  shop_service: {
    key: "business.add_new.category.shop_service",
    tag: "Shop & Services",
  },
  notary_service: {
    key: "business.add_new.category.notary_service",
    tag: "Notary Services",
  },
  bar_restaurant: {
    key: "business.add_new.category.bar_restaurant",
    tag: "Bar & Restaurant",
  },
};

export async function startAddNewBusiness(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: 'business_add_new',
    data: { stage: 'name' } as AddNewBusinessState,
  });

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "business.add_new.prompt_name"),
    [{ id: IDS.BACK_MENU, title: t(ctx.locale, 'common.buttons.cancel') }],
  );
  await logStructuredEvent('BUSINESS_ADD_NEW_STARTED', { profile_id: ctx.profileId });
  return true;
}

export async function handleAddNewBusinessText(
  ctx: RouterContext,
  body: string,
  state: AddNewBusinessState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const text = body.trim();
  if (!text) return true;

  // Name stage
  if (state.stage === 'name') {
    await setState(ctx.supabase, ctx.profileId, {
      key: 'business_add_new',
      data: { stage: 'location', name: text },
    });
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "business.add_new.prompt_location"),
      [{ id: IDS.BACK_MENU, title: t(ctx.locale, 'common.buttons.cancel') }],
    );
    return true;
  }

  // Location stage
  if (state.stage === 'location') {
    const name = state.name!;
    await setState(ctx.supabase, ctx.profileId, {
      key: 'business_add_new',
      data: { stage: 'category', name, location: text },
    });

    // Show category picker as list
    const rows = Object.entries(CATEGORY_DEFS).map(([slug, def]) => ({
      id: `BIZCAT::${slug}`,
      title: t(ctx.locale, def.key),
      description: undefined,
    }));
    await sendListMessage(
      ctx,
      {
        title: t(ctx.locale, "business.add_new.category_title"),
        body: t(ctx.locale, "business.add_new.category_body", {
          name,
          location: text,
        }),
        sectionTitle: t(ctx.locale, "business.add_new.category_section"),
        rows: [
          ...rows,
          {
            id: IDS.BACK_MENU,
            title: t(ctx.locale, "common.menu_back"),
          },
        ],
        buttonText: t(ctx.locale, 'common.buttons.choose'),
      },
      { emoji: '🏢' },
    );
    return true;
  }

  return false;
}

export async function handleAddNewBusinessSelect(
  ctx: RouterContext,
  id: string,
  state: AddNewBusinessState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  if (!id.startsWith('BIZCAT::')) return false;
  const category = id.split('::')[1];
  const name = state.name!;
  const location = state.location!;
  const def = CATEGORY_DEFS[category] ?? {
    tag: "Business",
    key: "business.add_new.category.generic",
  };

  // Insert the business record
  const { data, error } = await ctx.supabase
    .from('business')
    .insert({
      name,
      location_text: location,
      category_name: def.tag,
      owner_user_id: ctx.profileId,
      owner_whatsapp: ctx.from,
      is_active: true,
      tag: def.tag,
    })
    .select('id')
    .single();

  if (error) {
    console.error('business.add_new.insert_error', error);
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "business.add_new.error"),
      homeOnly(),
    );
    await clearState(ctx.supabase, ctx.profileId);
    return true;
  }

  // Track as profile asset
  await ctx.supabase.from('profile_assets').insert({
    profile_id: ctx.profileId,
    kind: 'business',
    reference_id: data.id,
  });

  await sendButtonsMessage(
    ctx,
    t(ctx.locale, "business.add_new.success", {
      name,
      category: t(ctx.locale, def.key),
    }),
    [
      {
        id: IDS.PROFILE_BUSINESSES,
        title: t(ctx.locale, "business.claim.view_my_businesses"),
      },
      { id: IDS.BACK_HOME, title: t(ctx.locale, "common.home_button") },
    ],
  );
  await maybeCreateBarFromBusiness(ctx, data.id, name, location, category);
  await clearState(ctx.supabase, ctx.profileId);
  await logStructuredEvent('BUSINESS_ADDED_NEW', { profile_id: ctx.profileId, business_id: data.id });
  return true;
}

async function maybeCreateBarFromBusiness(
  ctx: RouterContext,
  businessId: string,
  name: string,
  location: string,
  category: string,
) {
  if (category !== 'bar_restaurant') return;
  try {
    const slug = buildSlug(name);
    const { data: bar, error } = await ctx.supabase
      .from('bars')
      .insert({
        name,
        slug,
        location_text: location || null,
        country: 'Rwanda',
        whatsapp_number: ctx.from,
        is_active: true,
        claimed: true,
      })
      .select('id')
      .single();
    if (error || !bar?.id) throw error || new Error('bar_create_failed');

    await ctx.supabase
      .from('business')
      .update({ bar_id: bar.id, tag: 'Bar & Restaurant' })
      .eq('id', businessId);

    await ctx.supabase
      .from('bar_managers')
      .upsert({
        bar_id: bar.id,
        user_id: ctx.profileId,
        role: 'owner',
        is_active: true,
      }, { onConflict: 'bar_id,user_id' });
  } catch (error) {
    console.error('business.add_new.bar_create_fail', error);
  }
}

function buildSlug(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const tail = crypto.randomUUID().slice(0, 8);
  return `${base || 'venue'}-${tail}`;
}
