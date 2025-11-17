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

const CATEGORY_OPTIONS: Array<{ id: string; title: string; desc?: string }> = [
  { id: 'BIZCAT::pharmacy', title: 'Pharmacy' },
  { id: 'BIZCAT::quincaillerie', title: 'Quincaillerie' },
  { id: 'BIZCAT::shop_service', title: 'Shop & Services' },
  { id: 'BIZCAT::notary_service', title: 'Notary Services' },
  { id: 'BIZCAT::bar_restaurant', title: 'Bar & Restaurant' },
];

export async function startAddNewBusiness(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: 'business_add_new',
    data: { stage: 'name' } as AddNewBusinessState,
  });

  await sendButtonsMessage(
    ctx,
    'Please type the business name (as customers would see it).',
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
      'Great. Now enter the business location or address (e.g., Kigali, Remera).',
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
    await sendListMessage(
      ctx,
      {
        title: 'Choose a business category',
        body: `Name: ${name}\nLocation: ${text}`,
        sectionTitle: 'Categories',
        rows: [
          ...CATEGORY_OPTIONS,
          { id: IDS.BACK_MENU, title: t(ctx.locale, 'common.menu_back') },
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

  // Insert the business record
  const { data, error } = await ctx.supabase
    .from('business')
    .insert({
      name,
      location_text: location,
      category_name: category,
      owner_user_id: ctx.profileId,
      owner_whatsapp: ctx.from,
      is_active: true,
    })
    .select('id')
    .single();

  if (error) {
    console.error('business.add_new.insert_error', error);
    await sendButtonsMessage(
      ctx,
      'Could not save business. Please try again.',
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
    `Business added: ${name} (${category}). You can now manage it under My Businesses.`,
    homeOnly(),
  );
  await clearState(ctx.supabase, ctx.profileId);
  await logStructuredEvent('BUSINESS_ADDED_NEW', { profile_id: ctx.profileId, business_id: data.id });
  return true;
}

