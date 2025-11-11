import type { RouterContext } from "../../types.ts";
import { sendButtonsMessage, sendListMessage } from "../../utils/reply.ts";
import { buildWaLink } from "../../utils/share.ts";
import { IDS } from "../../wa/ids.ts";
import { setState } from "../../state/store.ts";
import { logWalletAdjust } from "../../observe/log.ts";
import { sendImageUrl } from "../../wa/client.ts";
import { startWallet, walletBackRow } from "./home.ts";
import type { SupabaseClient } from "../../deps.ts";
import { t } from "../../i18n/translator.ts";

const STATE_KEY = "wallet_share";

type ShareState = {
  key: string;
  data?: {
    code: string;
    shortLink: string;
    waLink: string;
    qrUrl: string;
  };
};

const SHORT_LINK_PREFIX = "https://easy.mo/r/";
const QR_BASE = "https://quickchart.io/qr?text=";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function showWalletEarn(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  try {
    const share = await ensureReferralLink(ctx);
    await setState(ctx.supabase, ctx.profileId, {
      key: STATE_KEY,
      data: share,
    });
    await sendListMessage(
      ctx,
      {
        title: t(ctx.locale, "wallet.earn.title"),
        body: t(ctx.locale, "wallet.earn.body"),
        sectionTitle: t(ctx.locale, "wallet.earn.section"),
        buttonText: t(ctx.locale, "wallet.earn.button"),
        rows: [
          {
            id: IDS.WALLET_SHARE_WHATSAPP,
            title: t(ctx.locale, "wallet.earn.rows.whatsapp.title"),
            description: t(ctx.locale, "wallet.earn.rows.whatsapp.description"),
          },
          {
            id: IDS.WALLET_SHARE_COPY,
            title: t(ctx.locale, "wallet.earn.rows.copy.title"),
            description: t(ctx.locale, "wallet.earn.rows.copy.description"),
          },
          {
            id: IDS.WALLET_SHARE_QR,
            title: t(ctx.locale, "wallet.earn.rows.qr.title"),
            description: t(ctx.locale, "wallet.earn.rows.qr.description"),
          },
          walletBackRow(),
        ],
      },
      { emoji: "🏆" },
    );
    await logWalletAdjust({
      actor: ctx.from,
      action: "referral_share_menu",
    });
    return true;
  } catch (error) {
    console.error("wallet.share_fail", error);
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "wallet.earn.error"),
      [{ id: IDS.WALLET_SHARE_DONE, title: t(ctx.locale, "wallet.buttons.done") }],
    );
    return true;
  }
}

export async function handleWalletEarnSelection(
  ctx: RouterContext,
  state: ShareState,
  id: string,
): Promise<boolean> {
  if (!ctx.profileId || state.key !== STATE_KEY) return false;
  const share = state.data;
  if (!share) {
    await sendButtonsMessage(
      ctx,
      t(ctx.locale, "wallet.earn.missing_share"),
      [{ id: IDS.WALLET_SHARE_DONE, title: t(ctx.locale, "wallet.buttons.done") }],
    );
    return true;
  }
  switch (id) {
    case IDS.WALLET_SHARE_WHATSAPP: {
      const body = [
        t(ctx.locale, "wallet.earn.whatsapp.body"),
        share.waLink,
      ].join("\n\n");
      await sendButtonsMessage(
        ctx,
        body,
        [{ id: IDS.WALLET_SHARE_DONE, title: t(ctx.locale, "wallet.buttons.copy") }],
      );
      await logWalletAdjust({
        actor: ctx.from,
        action: "referral_share_whatsapp",
      });
      return true;
    }
    case IDS.WALLET_SHARE_COPY: {
      const body = [
        t(ctx.locale, "wallet.earn.copy.body"),
        share.shortLink,
        t(ctx.locale, "wallet.earn.copy.code", { code: share.code }),
      ].join("\n\n");
      await sendButtonsMessage(
        ctx,
        body,
        [{ id: IDS.WALLET_SHARE_DONE, title: t(ctx.locale, "wallet.buttons.done") }],
      );
      await logWalletAdjust({
        actor: ctx.from,
        action: "referral_share_copy",
      });
      return true;
    }
    case IDS.WALLET_SHARE_QR: {
      await sendImageUrl(
        ctx.from,
        share.qrUrl,
        t(ctx.locale, "wallet.earn.qr.caption", { link: share.shortLink }),
      );
      await sendButtonsMessage(
        ctx,
        t(ctx.locale, "wallet.earn.qr.body"),
        [{ id: IDS.WALLET_SHARE_DONE, title: t(ctx.locale, "wallet.buttons.done") }],
      );
      await logWalletAdjust({
        actor: ctx.from,
        action: "referral_share_qr",
      });
      return true;
    }
    case IDS.BACK_MENU:
      return await startWallet(ctx, { key: "wallet_home", data: {} });
    default:
      return false;
  }
}

export async function handleWalletShareDone(
  ctx: RouterContext,
): Promise<boolean> {
  return await showWalletEarn(ctx);
}

async function ensureReferralLink(
  ctx: RouterContext,
): Promise<{ code: string; shortLink: string; waLink: string; qrUrl: string }> {
  const profileId = ctx.profileId!;
  const client = ctx.supabase;
  const existing = await client
    .from("referral_links")
    .select("code, short_url")
    .eq("user_id", profileId)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.error) throw existing.error;

  let code = existing.data?.code ?? "";
  if (!code) {
    code = await insertReferralLink(client, profileId);
  } else if (!existing.data?.short_url) {
    const shortLink = buildShortLink(code);
    const { error: updateError } = await client
      .from("referral_links")
      .update({ short_url: shortLink })
      .eq("user_id", profileId)
      .eq("code", code);
    if (updateError) {
      console.error("wallet.referral_short_update_fail", updateError);
    }
  }

  const shortLink = existing.data?.short_url ?? buildShortLink(code);
  const waLink = buildWaLink(`REF:${code}`) || shortLink;
  const qrUrl = `${QR_BASE}${encodeURIComponent(shortLink)}`;

  return { code, shortLink, waLink, qrUrl };
}

async function insertReferralLink(
  client: SupabaseClient,
  profileId: string,
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    const shortLink = buildShortLink(code);
    const { data, error } = await client
      .from("referral_links")
      .insert({
        user_id: profileId,
        code,
        short_url: shortLink,
        active: true,
      })
      .select("code")
      .single();
    if (!error && data?.code) {
      return data.code;
    }
    if (error && error.code === "23505") {
      continue;
    }
    if (error) throw error;
  }
  throw new Error("Failed to create referral link after retries");
}

function generateReferralCode(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = "";
  for (const byte of bytes) {
    result += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return result;
}

function buildShortLink(code: string): string {
  return `${SHORT_LINK_PREFIX}${code}`;
}
