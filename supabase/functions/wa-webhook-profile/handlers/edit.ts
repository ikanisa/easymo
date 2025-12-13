import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { setState, getState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";
import { sendListMessage } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";

export const EDIT_STATES = {
  MENU: "profile_edit_menu",
  NAME: "profile_edit_name",
  LANGUAGE: "profile_edit_language"
};

const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "fr", name: "Français (French)" },
  { code: "rw", name: "Kinyarwanda" },
  { code: "sw", name: "Kiswahili (Swahili)" }
];

export async function startEditProfile(ctx: RouterContext): Promise<boolean> {
  await setState(ctx.supabase, ctx.profileId!, {
    key: EDIT_STATES.MENU,
    data: {}
  });

  await logStructuredEvent("PROFILE_EDIT_START", {
    userId: ctx.profileId
  });

  // Get current profile
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("name, language, wa_id")
    .eq("user_id", ctx.profileId)
    .single();

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === profile?.language)?.name || "English";

  await sendListMessage(ctx, {
    title: "✏️ Edit Profile",
    body: `*Current Info:*\n\nName: ${profile?.name || "Not set"}\nLanguage: ${currentLang}\nPhone: ${profile?.wa_id || ctx.from}\n\nWhat would you like to update?`,
    buttonText: "Select Option",
    rows: [
      { id: "EDIT_PROFILE_NAME", title: "📝 Update Name", description: "Change your display name" },
      { id: "EDIT_PROFILE_LANGUAGE", title: "🌍 Change Language", description: "Select preferred language" },
      { id: IDS.BACK_PROFILE, title: "← Back to Profile" }
    ]
  });

  return true;
}

export async function promptEditName(ctx: RouterContext): Promise<boolean> {
  await setState(ctx.supabase, ctx.profileId!, {
    key: EDIT_STATES.NAME,
    data: {}
  });

  await sendText(ctx.from,
    "📝 *Update Your Name*\n\n" +
    "Please enter your new name:\n\n" +
    "Type your full name or 'cancel' to go back."
  );

  return true;
}

export async function handleEditName(
  ctx: RouterContext,
  newName: string
): Promise<boolean> {
  const trimmedName = newName.trim();

  // Validation: minimum length
  if (trimmedName.length < 2) {
    await sendText(ctx.from, "❌ Name must be at least 2 characters long.");
    return true;
  }

  // Validation: maximum length
  if (trimmedName.length > 100) {
    await sendText(ctx.from, "❌ Name is too long (max 100 characters).");
    return true;
  }

  // Validation: alphanumeric and common characters only (prevent injection)
  const validNamePattern = /^[\p{L}\p{N}\s\-'.]+$/u;
  if (!validNamePattern.test(trimmedName)) {
    await sendText(ctx.from, "❌ Name contains invalid characters. Please use only letters, numbers, spaces, hyphens, and apostrophes.");
    return true;
  }

  try {
    const { error } = await ctx.supabase
      .from("profiles")
      .update({ name: trimmedName, updated_at: new Date().toISOString() })
      .eq("user_id", ctx.profileId);

    if (error) {
      await logStructuredEvent("PROFILE_EDIT_NAME_ERROR", {
        userId: ctx.profileId,
        error: error.message
      }, "error");

      await sendText(ctx.from, "❌ Error updating name. Please try again.");
      return false;
    }

    await setState(ctx.supabase, ctx.profileId!, {
      key: "home",
      data: {}
    });

    await sendText(ctx.from,
      `✅ *Name Updated!*\n\n` +
      `Your new name: ${trimmedName}\n\n` +
      `Type 'profile' to view your updated profile.`
    );

    await logStructuredEvent("PROFILE_NAME_UPDATED", {
      userId: ctx.profileId,
      // Note: Not logging actual name for privacy
    });

    return true;
  } catch (error) {
    await logStructuredEvent("PROFILE_EDIT_NAME_EXCEPTION", {
      userId: ctx.profileId,
      error: error instanceof Error ? error.message : String(error)
    }, "error");

    await sendText(ctx.from, "❌ Unexpected error. Please try again later.");
    return false;
  }
}

export async function promptEditLanguage(ctx: RouterContext): Promise<boolean> {
  await setState(ctx.supabase, ctx.profileId!, {
    key: EDIT_STATES.LANGUAGE,
    data: {}
  });

  await sendListMessage(ctx, {
    title: "🌍 Select Language",
    body: "Choose your preferred language for messages:",
    buttonText: "Select Language",
    rows: [
      ...SUPPORTED_LANGUAGES.map(lang => ({
        id: `LANG::${lang.code}`,
        title: lang.name,
        description: `Switch to ${lang.name}`
      })),
      { id: IDS.BACK_PROFILE, title: "← Cancel" }
    ]
  });

  return true;
}

export async function handleEditLanguage(
  ctx: RouterContext,
  languageCode: string
): Promise<boolean> {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === languageCode);

  if (!lang) {
    await sendText(ctx.from, "❌ Invalid language selection.");
    return false;
  }

  try {
    const { error } = await ctx.supabase
      .from("profiles")
      .update({ language: lang.code, updated_at: new Date().toISOString() })
      .eq("user_id", ctx.profileId);

    if (error) {
      await logStructuredEvent("PROFILE_EDIT_LANGUAGE_ERROR", {
        userId: ctx.profileId,
        error: error.message
      }, "error");

      await sendText(ctx.from, "❌ Error updating language. Please try again.");
      return false;
    }

    await setState(ctx.supabase, ctx.profileId!, {
      key: "home",
      data: {}
    });

    await sendText(ctx.from,
      `✅ *Language Updated!*\n\n` +
      `New language: ${lang.name}\n\n` +
      `Note: Full translations coming soon. For now, most messages remain in English.`
    );

    await logStructuredEvent("PROFILE_LANGUAGE_UPDATED", {
      userId: ctx.profileId,
      newLanguage: lang.code
    });

    return true;
  } catch (error) {
    await logStructuredEvent("PROFILE_EDIT_LANGUAGE_EXCEPTION", {
      userId: ctx.profileId,
      error: error instanceof Error ? error.message : String(error)
    }, "error");

    await sendText(ctx.from, "❌ Unexpected error. Please try again later.");
    return false;
  }
}
