import type { RouterContext } from "../../types.ts";
import { sendButtonsMessage, sendListMessage } from "../../utils/reply.ts";
import { ensureReferralLink as ensureReferralLinkShared } from "../../utils/share.ts";
import { IDS } from "../../wa/ids.ts";
import { setState } from "../../state/store.ts";
import { logWalletAdjust } from "../../observe/log.ts";
import { sendImageUrl } from "../../wa/client.ts";
import { startWallet, walletBackRow } from "./home.ts";
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
  let share = state.data;
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
        t(ctx.locale, "wallet.earn.copy.code", { code: share.code }),
        t(ctx.locale, "wallet.earn.note.keep_code"),
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
    case IDS.WALLET_SHARE_QR: {
      let qrShare = share;
      try {
        qrShare = await ensureReferralLink(ctx);
        share = qrShare;
        await setState(ctx.supabase, ctx.profileId, {
          key: STATE_KEY,
          data: qrShare,
        });
      } catch (_) {
        // fall back to existing share data
      }
      await sendImageUrl(
        ctx.from,
        qrShare.qrUrl,
        t(ctx.locale, "wallet.earn.qr.caption", { link: qrShare.shortLink }),
      );
      const qrBody = [
        t(ctx.locale, "wallet.earn.qr.body"),
        t(ctx.locale, "wallet.earn.note.keep_code"),
      ].join("\n\n");
      await sendButtonsMessage(
        ctx,
        qrBody,
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
  return await ensureReferralLinkShared(ctx.supabase, profileId);
}
