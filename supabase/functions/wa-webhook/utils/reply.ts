import type { ButtonSpec, RouterContext } from "../types.ts";
import { sendButtons, sendList } from "../wa/client.ts";
import { IDS } from "../wa/ids.ts";
import { t } from "../i18n/translator.ts";
import { ensureReferralLink } from "./share.ts";

const HOME_BUTTON: ButtonSpec = { id: IDS.BACK_HOME, title: "🏠 Home" };

function ensureHomeButton(buttons: ButtonSpec[], max = 3): ButtonSpec[] {
  if (!buttons.length) {
    return [HOME_BUTTON];
  }
  return buttons.slice(0, max);
}

function coerceBody(body: string, emojiPrefix = ""): string {
  const trimmed = body.trim();
  const prefix = emojiPrefix ? `${emojiPrefix} ` : "";
  return `${prefix}${trimmed}`.trim();
}

export async function sendButtonsMessage(
  ctx: RouterContext,
  body: string,
  buttons: ButtonSpec[],
  options: { emoji?: string } = {},
): Promise<void> {
  let augmented = [...buttons];
  // Auto-append Share button if room (<3 actions)
  try {
    const hasAdmin = buttons.some((b) =>
      typeof b?.id === 'string' && (b.id.startsWith('ADMIN::') || b.id.toLowerCase().includes('admin'))
    );
    const canAutoShare = Boolean(
      !hasAdmin &&
        augmented.length < 3 &&
        ctx.profileId,
    );
    if (canAutoShare) {
      const already = augmented.some((b) =>
        b.id === IDS.SHARE_EASYMO || b.url?.includes("share") ||
        b.kind === "url_share"
      );
      if (!already && ctx.profileId) {
        const share = await ensureReferralLink(ctx.supabase, ctx.profileId);
        const inviteMessage = t(ctx.locale, "wallet.earn.share.prefill_message", {
          link: share.waLink || share.shortLink,
          code: share.code,
        });
        const shareUrl = `https://wa.me/?text=${encodeURIComponent(inviteMessage)}`;
        augmented.push({
          id: IDS.SHARE_EASYMO,
          title: t(ctx.locale, "common.buttons.share_easymo"),
          url: shareUrl,
          kind: "url",
        });
      }
    }
  } catch (err) {
    console.warn("reply.auto_share_failed", { err: (err as Error)?.message });
  }
  const payload = ensureHomeButton(augmented).map((button) => {
    if (button.id === IDS.BACK_HOME) {
      return { ...button, title: t(ctx.locale, "common.home_button") };
    }
    return button;
  });
  await sendButtons(ctx.from, coerceBody(body, options.emoji ?? ""), payload);
}

export async function sendListWithActions(
  ctx: RouterContext,
  list: {
    title: string;
    body: string;
    sectionTitle: string;
    rows: Array<{ id: string; title: string; description?: string }>;
    buttonText?: string;
  },
  actions: ButtonSpec[],
  options: { emoji?: string } = {},
): Promise<void> {
  await sendList(ctx.from, {
    ...list,
    buttonText: list.buttonText ?? t(ctx.locale, "common.buttons.choose"),
  });
  const trimmed = actions.filter((action) =>
    Boolean(action?.id && action?.title)
  );
  if (!trimmed.length) return;
  await sendButtonsMessage(ctx, list.body, trimmed, options);
}

export async function sendListMessage(
  ctx: RouterContext,
  list: {
    title: string;
    body: string;
    sectionTitle: string;
    rows: Array<{ id: string; title: string; description?: string }>;
    buttonText?: string;
  },
  options: { emoji?: string } = {},
): Promise<void> {
  await sendList(ctx.from, {
    ...list,
    body: coerceBody(list.body, options.emoji ?? ""),
    buttonText: list.buttonText ?? t(ctx.locale, "common.buttons.select"),
  });
}

export function homeOnly(): ButtonSpec[] {
  return [HOME_BUTTON];
}

export function buildButtons(
  primary: ButtonSpec,
  ...others: ButtonSpec[]
): ButtonSpec[] {
  return ensureHomeButton([primary, ...others]);
}
