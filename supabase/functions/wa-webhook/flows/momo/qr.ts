import type { RouterContext } from "../../types.ts";
import { sendImageUrl } from "../../wa/client.ts";
import { IDS } from "../../wa/ids.ts";
import { clearState, setState } from "../../state/store.ts";
import { buildMomoUssd } from "../../utils/momo.ts";
import { maskPhone } from "../support.ts";
import { buildWaLink } from "../../utils/share.ts";
import { logMomoQrRequest } from "../../rpc/momo.ts";
import { logEvent } from "../../observe/log.ts";
import {
  buildButtons,
  sendButtonsMessage,
  sendListMessage,
} from "../../utils/reply.ts";
import { sendHomeMenu } from "../home.ts";

const STATES = {
  MENU: "momo_qr_menu",
  NUMBER_INPUT: "momo_qr_number",
  CODE_INPUT: "momo_qr_code",
  AMOUNT_INPUT: "momo_qr_amount",
} as const;

type MomoState = { key: string; data?: Record<string, unknown> };
type MomoData = {
  target: string;
  targetType: "msisdn" | "code";
  display: string;
  e164?: string;
};

export async function startMomoQr(
  ctx: RouterContext,
  _state: MomoState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  await setState(ctx.supabase, ctx.profileId, { key: STATES.MENU, data: {} });
  const selfNumber = normalizeMsisdn(ctx.from);
  const rows = [
    {
      id: IDS.MOMO_QR_MY,
      title: "Use my number",
      description: selfNumber
        ? `Use ${selfNumber.local} from this chat.`
        : "Use your WhatsApp number (07…).",
    },
    {
      id: IDS.MOMO_QR_NUMBER,
      title: "Enter number",
      description: "Provide the customer's 07… MoMo number.",
    },
    {
      id: IDS.MOMO_QR_CODE,
      title: "Enter code",
      description: "Use the merchant paycode instead of a number.",
    },
    {
      id: IDS.BACK_MENU,
      title: "← Back",
      description: "Return to the main menu.",
    },
  ];
  await sendListMessage(
    ctx,
    {
      title: "💳 MoMo QR",
      body: "Generate a payment QR in seconds.",
      sectionTitle: "Options",
      rows,
      buttonText: "View",
    },
    { emoji: "💳" },
  );
  return true;
}

export async function handleMomoButton(
  ctx: RouterContext,
  id: string,
  state: MomoState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  switch (id) {
    case IDS.MOMO_QR_MY: {
      const normalized = normalizeMsisdn(ctx.from);
      if (!normalized) {
        await sendButtonsMessage(
          ctx,
          "⚠️ Couldn't read your MoMo number. Reply with your 07… number instead.",
          buildButtons({ id: IDS.MOMO_QR, title: "↩️ Menu" }),
        );
        return true;
      }
      const { local, e164 } = normalized;
      const display = maskPhone(e164);
      await setState(ctx.supabase, ctx.profileId, {
        key: STATES.AMOUNT_INPUT,
        data: {
          target: local,
          targetType: "msisdn",
          display,
          e164,
        },
      });
      await promptAmount(ctx, display);
      return true;
    }
    case IDS.MOMO_QR_NUMBER:
      await setState(ctx.supabase, ctx.profileId, {
        key: STATES.NUMBER_INPUT,
        data: {},
      });
      await sendButtonsMessage(
        ctx,
        "📱 Send the customer's MoMo number (format 07XXXXXXXX).",
        buildButtons({ id: IDS.MOMO_QR, title: "↩️ Menu" }),
      );
      return true;
    case IDS.MOMO_QR_CODE:
      await setState(ctx.supabase, ctx.profileId, {
        key: STATES.CODE_INPUT,
        data: {},
      });
      await sendButtonsMessage(
        ctx,
        "🏪 Send the merchant paycode (digits only).",
        buildButtons({ id: IDS.MOMO_QR, title: "↩️ Menu" }),
      );
      return true;
    case IDS.BACK_MENU:
      await clearState(ctx.supabase, ctx.profileId);
      await sendHomeMenu(ctx);
      return true;
    default:
      return false;
  }
}

export async function handleMomoText(
  ctx: RouterContext,
  body: string,
  state: MomoState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const trimmed = body.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower === "home") {
    await clearState(ctx.supabase, ctx.profileId);
    await sendHomeMenu(ctx);
    return true;
  }
  if (lower === "menu" || lower === "back") {
    await startMomoQr(ctx, state);
    return true;
  }

  switch (state.key) {
    case STATES.NUMBER_INPUT:
      return await handleNumberInput(ctx, trimmed);
    case STATES.CODE_INPUT:
      return await handleCodeInput(ctx, trimmed);
    case STATES.AMOUNT_INPUT:
      return await handleAmountInput(ctx, trimmed, state);
    default:
      return false;
  }
}

async function handleNumberInput(
  ctx: RouterContext,
  input: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const normalized = normalizeMsisdn(input);
  if (!normalized) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Invalid number. Use format 07XXXXXXXX.",
      buildButtons({ id: IDS.MOMO_QR, title: "↩️ Menu" }),
    );
    return true;
  }
  const { local, e164 } = normalized;
  const display = maskPhone(e164);
  await setState(ctx.supabase, ctx.profileId, {
    key: STATES.AMOUNT_INPUT,
    data: {
      target: local,
      targetType: "msisdn",
      display,
      e164,
    },
  });
  await promptAmount(ctx, display);
  return true;
}

async function handleCodeInput(
  ctx: RouterContext,
  input: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const code = sanitizeCode(input);
  if (!code) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Invalid code. Use 4-12 digits.",
      buildButtons({ id: IDS.MOMO_QR, title: "↩️ Menu" }),
    );
    return true;
  }
  await setState(ctx.supabase, ctx.profileId, {
    key: STATES.AMOUNT_INPUT,
    data: {
      target: code,
      targetType: "code",
      display: code,
    },
  });
  await promptAmount(ctx, code);
  return true;
}

async function handleAmountInput(
  ctx: RouterContext,
  input: string,
  state: MomoState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const data = (state.data ?? {}) as MomoData;
  if (!data?.target || !data?.targetType) {
    await startMomoQr(ctx, state);
    return true;
  }
  const parsed = parseAmount(input);
  if (parsed === undefined) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Enter an amount like 12000 or tap Skip.",
      buildButtons({ id: IDS.MOMO_QR, title: "↩️ Menu" }),
    );
    return true;
  }
  await deliverMomoQr(ctx, data, parsed);
  return true;
}

async function deliverMomoQr(
  ctx: RouterContext,
  data: MomoData,
  amountRwf: number | null,
): Promise<void> {
  const isCode = data.targetType === "code";
  const targetValue = data.targetType === "msisdn" ? data.target : data.target;
  const { ussd, telUri } = buildMomoUssd(
    targetValue,
    isCode,
    amountRwf ?? undefined,
  );
  const qrUrl = buildQrLink(telUri);
  const lines: string[] = [
    `Target: ${data.display}`,
    `Dial: ${ussd}`,
    `Tap: ${telUri}`,
  ];
  if (amountRwf && amountRwf > 0) {
    lines.splice(1, 0, `Amount: RWF ${amountRwf.toLocaleString("en-US")}`);
  }
  const shareLink = buildWaLink(`Pay via MoMo ${data.display}: ${ussd}`);
  if (shareLink) {
    lines.push(`Share: ${shareLink}`);
  }
  await sendImageUrl(ctx.from, qrUrl, `Scan to pay ${data.display}`);
  await sendButtonsMessage(
    ctx,
    lines.join("\n"),
    buildButtons({ id: IDS.MOMO_QR, title: "🔁 New QR" }),
  );
  const loggedTarget = data.targetType === "msisdn"
    ? data.e164 ?? localToE164(targetValue)
    : targetValue;
  await logMomoQrRequest(ctx.supabase, {
    requesterWaId: ctx.from,
    target: loggedTarget,
    targetType: data.targetType,
    amountMinor: amountRwf && amountRwf > 0 ? amountRwf * 100 : null,
    qrUrl,
    ussd,
    telUri,
  });
  await logEvent("MOMO_QR", {
    requester: ctx.from,
    target: loggedTarget,
    target_type: data.targetType,
    amount_minor: amountRwf && amountRwf > 0 ? amountRwf * 100 : null,
  });
  await clearState(ctx.supabase, ctx.profileId!);
}

type NormalizedMsisdn = { local: string; e164: string };

function normalizeMsisdn(raw: string): NormalizedMsisdn | null {
  const digitsOnly = raw.replace(/\D/g, "");
  if (!digitsOnly) return null;

  let digits = digitsOnly;
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("2507") && digits.length >= 12) {
    const core = digits.slice(0, 12);
    const local = `0${core.slice(-9)}`;
    return { local, e164: `+${core}` };
  }

  if (digits.startsWith("07") && digits.length === 10) {
    const withoutZero = digits.slice(1);
    return { local: digits, e164: `+250${withoutZero}` };
  }

  if (digits.startsWith("7") && digits.length === 9) {
    return { local: `0${digits}`, e164: `+250${digits}` };
  }

  return null;
}

function sanitizeCode(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 4 || digits.length > 12) return null;
  return digits;
}

async function promptAmount(
  ctx: RouterContext,
  display: string,
): Promise<void> {
  await sendButtonsMessage(
    ctx,
    `💰 Enter amount in RWF for ${display} (or reply Skip).`,
    buildButtons({ id: IDS.MOMO_QR, title: "↩️ Menu" }),
  );
}

function parseAmount(input: string): number | null | undefined {
  const lower = input.trim().toLowerCase();
  if (!lower || lower === "skip") return null;
  const digits = input.replace(/\D/g, "");
  if (!digits) return undefined;
  const value = Number(digits);
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return value;
}

function buildQrLink(text: string): string {
  const encoded = encodeURIComponent(text);
  return `https://quickchart.io/qr?size=512&margin=2&text=${encoded}`;
}

function localToE164(local: string): string {
  if (!local) return local;
  if (local.startsWith("+")) return local;
  if (local.startsWith("07") && local.length === 10) {
    return `+250${local.slice(1)}`;
  }
  return local.startsWith("250") ? `+${local}` : local;
}
