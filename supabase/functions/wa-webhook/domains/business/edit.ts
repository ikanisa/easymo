import type { RouterContext } from "../../types.ts";
import { sendButtonsMessage, sendListMessage, buildButtons, homeOnly } from "../../utils/reply.ts";
import { IDS } from "../../wa/ids.ts";
import { setState, clearState } from "../../state/store.ts";
import { t } from "../../i18n/translator.ts";

export type BusinessEditState = {
  businessId: string;
  businessName: string;
  stage?:
    | "menu"
    | "awaiting_name"
    | "awaiting_category"
    | "awaiting_location"
    | "awaiting_specialties"
    | "awaiting_promotions";
};

const STATE_KEY = "business_edit";

export async function startBusinessEdit(
  ctx: RouterContext,
  businessId: string,
  businessName: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: STATE_KEY,
    data: { businessId, businessName, stage: "menu" } as BusinessEditState,
  });

  await sendListMessage(
    ctx,
    {
      title: `Edit ${businessName}`,
      body: "Update business details",
      sectionTitle: "Fields",
      rows: [
        { id: IDS.BUSINESS_EDIT_NAME, title: "Name", description: "Change business name" },
        { id: IDS.BUSINESS_EDIT_LOCATION, title: "Location", description: "Update location text" },
        { id: IDS.BUSINESS_EDIT_CATEGORY, title: "Category", description: "Update category name" },
        { id: IDS.BUSINESS_EDIT_SPECIALTIES, title: "Specialties", description: "Comma-separated specialties" },
        { id: IDS.BUSINESS_EDIT_PROMOTIONS, title: "Promotions & Events", description: "Add promo/event text" },
        { id: IDS.PROFILE_MANAGE_BUSINESSES, title: "← Back", description: "Return to My Businesses" },
      ],
      buttonText: "Choose",
    },
    { emoji: "✏️" },
  );
  return true;
}

export async function handleBusinessEditAction(
  ctx: RouterContext,
  state: BusinessEditState,
  actionId: string,
): Promise<boolean> {
  if (!ctx.profileId || !state.businessId) return false;

  const setStage = async (stage: BusinessEditState["stage"]) =>
    await setState(ctx.supabase, ctx.profileId!, { key: STATE_KEY, data: { ...state, stage } });

  switch (actionId) {
    case IDS.BUSINESS_EDIT_NAME:
      await setStage("awaiting_name");
      await sendButtonsMessage(
        ctx,
        "Send the new business name",
        buildButtons({ id: IDS.BACK_MENU, title: "Cancel" }),
      );
      return true;
    case IDS.BUSINESS_EDIT_LOCATION:
      await setStage("awaiting_location");
      await sendButtonsMessage(
        ctx,
        "Send the new location text (e.g., Kigali, Remera)",
        buildButtons({ id: IDS.BACK_MENU, title: "Cancel" }),
      );
      return true;
    case IDS.BUSINESS_EDIT_CATEGORY:
      await setStage("awaiting_category");
      await sendButtonsMessage(
        ctx,
        "Send the category name (e.g., Bar & Restaurant)",
        buildButtons({ id: IDS.BACK_MENU, title: "Cancel" }),
      );
      return true;
    case IDS.BUSINESS_EDIT_SPECIALTIES:
      await setStage("awaiting_specialties");
      await sendButtonsMessage(
        ctx,
        "Send specialties separated by commas (e.g., Grilled fish, Cocktails)",
        buildButtons({ id: IDS.BACK_MENU, title: "Cancel" }),
      );
      return true;
    case IDS.BUSINESS_EDIT_PROMOTIONS:
      await setStage("awaiting_promotions");
      await sendButtonsMessage(
        ctx,
        "Send promotion or event text (e.g., Friday live music, 2-for-1 cocktails)",
        buildButtons({ id: IDS.BACK_MENU, title: "Cancel" }),
      );
      return true;
    default:
      return false;
  }
}

export async function handleBusinessEditText(
  ctx: RouterContext,
  input: string,
  state: BusinessEditState,
): Promise<boolean> {
  if (!ctx.profileId || !state.businessId) return false;

  const table = ctx.supabase.from("business");
  const idEq = (q: any) => q.eq("id", state.businessId);

  const finish = async (message: string) => {
    await sendButtonsMessage(
      ctx,
      message,
      buildButtons({ id: IDS.PROFILE_MANAGE_BUSINESSES, title: "My Businesses" }),
    );
    await clearState(ctx.supabase, ctx.profileId!);
  };

  try {
    switch (state.stage) {
      case "awaiting_name": {
        const name = input.trim().slice(0, 120);
        if (!name) {
          await sendButtonsMessage(ctx, "Name cannot be empty.", homeOnly());
          return true;
        }
        const { error } = await idEq(table.update({ name }));
        if (error) throw error;
        await finish(`✅ Name updated to: ${name}`);
        return true;
      }
      case "awaiting_location": {
        const location_text = input.trim().slice(0, 200);
        const { error } = await idEq(table.update({ location_text }));
        if (error) throw error;
        await finish(`✅ Location updated.`);
        return true;
      }
      case "awaiting_category": {
        const category_name = input.trim().slice(0, 120);
        const { error } = await idEq(table.update({ category_name }));
        if (error) throw error;
        await finish(`✅ Category updated: ${category_name}`);
        return true;
      }
      case "awaiting_specialties": {
        const specialties = input
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 20);
        const { error } = await idEq(table.update({ specialties } as any));
        if (error) throw error;
        await finish(`✅ Specialties updated.`);
        return true;
      }
      case "awaiting_promotions": {
        // Store in metadata for now; dedicated table can be added later.
        const promo = input.trim().slice(0, 500);
        const { data: row } = await idEq(table.select("metadata").maybeSingle());
        const metadata = { ...(row?.metadata ?? {}), promo_last: promo } as Record<string, unknown>;
        const { error } = await idEq(table.update({ metadata } as any));
        if (error) throw error;
        await finish(`✅ Promotion saved.`);
        return true;
      }
      default:
        return false;
    }
  } catch (err) {
    console.error("business.edit.error", err);
    await sendButtonsMessage(ctx, "⚠️ Failed to update. Please try again.", homeOnly());
    return true;
  }
}

