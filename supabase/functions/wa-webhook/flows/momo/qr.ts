import type { RouterContext } from "../../types.ts";
import { sendButtons, sendImageUrl, sendText } from "../../wa/client.ts";
import { IDS } from "../../wa/ids.ts";
import { clearState, setState } from "../../state/store.ts";
import { sendHomeMenu } from "../home.ts";
import { buildMomoUssd } from "../../utils/momo.ts";
import { maskPhone } from "../support.ts";
import { toE164 } from "../../utils/phone.ts";
import { buildWaLink } from "../../utils/share.ts";
import { logMomoQrRequest } from "../../rpc/momo.ts";
import { logEvent } from "../../observe/log.ts";

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
};

export async function startMomoQr(
  ctx: RouterContext,
  _state: MomoState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  await setState(ctx.supabase, ctx.profileId, { key: STATES.MENU, data: {} });
  await sendButtons(ctx.from, "MoMo QR", [
    { id: IDS.MOMO_QR_MY, title: "Use my number" },
    { id: IDS.MOMO_QR_NUMBER, title: "Enter number" },
    { id: IDS.MOMO_QR_CODE, title: "Merchant code" },
  ]);
  await sendText(
    ctx.from,
    "Reply with amount when prompted. Send HOME to exit.",
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
      const target = ctx.from.startsWith("+") ? ctx.from : `+${ctx.from}`;
      await setState(ctx.supabase, ctx.profileId, {
        key: STATES.AMOUNT_INPUT,
        data: {
          target,
          targetType: "msisdn",
          display: maskPhone(target),
        },
      });
      await sendText(ctx.from, "Enter amount in RWF (or reply SKIP).");
      return true;
    }
    case IDS.MOMO_QR_NUMBER:
      await setState(ctx.supabase, ctx.profileId, {
        key: STATES.NUMBER_INPUT,
        data: {},
      });
      await sendText(
        ctx.from,
        "Send the customer's phone number (07… or +250…).",
      );
      return true;
    case IDS.MOMO_QR_CODE:
      await setState(ctx.supabase, ctx.profileId, {
        key: STATES.CODE_INPUT,
        data: {},
      });
      await sendText(ctx.from, "Send the merchant paycode (digits only).");
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
    await sendText(ctx.from, "Invalid number. Send format 07… or +250…");
    return true;
  }
  await setState(ctx.supabase, ctx.profileId, {
    key: STATES.AMOUNT_INPUT,
    data: {
      target: normalized,
      targetType: "msisdn",
      display: maskPhone(normalized),
    },
  });
  await sendText(ctx.from, "Enter amount in RWF (or reply SKIP).");
  return true;
}

async function handleCodeInput(
  ctx: RouterContext,
  input: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const code = sanitizeCode(input);
  if (!code) {
    await sendText(ctx.from, "Invalid code. Use 4-12 digits.");
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
  await sendText(ctx.from, "Enter amount in RWF (or reply SKIP).");
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
    await sendText(ctx.from, "Enter amount like 12000 or reply SKIP.");
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
  const { ussd, telUri } = buildMomoUssd(
    data.target,
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
  await sendText(ctx.from, lines.join("\n"));
  await logMomoQrRequest(ctx.supabase, {
    requesterWaId: ctx.from,
    target: data.target,
    targetType: data.targetType,
    amountMinor: amountRwf && amountRwf > 0 ? amountRwf * 100 : null,
    qrUrl,
    ussd,
    telUri,
  });
  await logEvent("MOMO_QR", {
    requester: ctx.from,
    target: data.target,
    target_type: data.targetType,
    amount_minor: amountRwf && amountRwf > 0 ? amountRwf * 100 : null,
  });
  await clearState(ctx.supabase, ctx.profileId!);
  await sendHomeMenu(ctx);
}

function normalizeMsisdn(raw: string): string | null {
  const digits = raw.replace(/[^0-9+]/g, "");
  if (!digits) return null;
  const e164 = toE164(digits);
  return /^\+2507\d{7}$/.test(e164) ? e164 : null;
}

function sanitizeCode(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 4 || digits.length > 12) return null;
  return digits;
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
