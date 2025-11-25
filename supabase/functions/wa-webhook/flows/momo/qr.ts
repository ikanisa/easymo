import type { RouterContext } from "../../types.ts";
import {
  sendImageUrl,
  sendText,
} from "../../wa/client.ts";
import { IDS } from "../../wa/ids.ts";
import { clearState, setState } from "../../state/store.ts";
import { buildMomoUssd, buildMomoUssdForQr } from "../../utils/momo.ts";
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
import { checkCountrySupport } from "../../domains/exchange/country_support.ts";

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
  const canUseSelf = await canUseSelfNumber(ctx);
  const selfNumber = canUseSelf
    ? normalizeMsisdn(ctx.from) ?? simpleNormalize(ctx.from)
    : null;
  const rows: Array<{ id: string; title: string; description: string }> = [];
  if (selfNumber) {
    rows.push({
      id: IDS.MOMO_QR_MY,
      title: "Use my number",
      description: `Use ${selfNumber.local} from this chat.`,
    });
  }
  rows.push(
    {
      id: IDS.MOMO_QR_NUMBER,
      title: "Enter number",
      description: "Provide the customer's MoMo number.",
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
  );
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
      const normalized = normalizeMsisdn(ctx.from) ?? simpleNormalize(ctx.from);
      if (!normalized) {
        await sendButtonsMessage(
          ctx,
          "⚠️ Couldn't read your MoMo number. Reply with your number instead.",
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
    case IDS.MOMO_QR_SKIP:
      if (state.key === STATES.AMOUNT_INPUT) {
        const data = (state.data ?? {}) as MomoData;
        if (!ctx.profileId || !data?.target || !data?.targetType) {
          await startMomoQr(ctx, state);
          return true;
        }
        await deliverMomoQr(ctx, data, null);
        return true;
      }
      return false;
    case IDS.MOMO_QR_NUMBER:
      await setState(ctx.supabase, ctx.profileId, {
        key: STATES.NUMBER_INPUT,
        data: {},
      });
      await sendButtonsMessage(
        ctx,
        "📱 Send the customer's MoMo number.",
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
        "🏪 Send the merchant paycode (4-12 digits).",
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

  if (
    state.key === STATES.MENU ||
    state.key === "" ||
    state.key === "home"
  ) {
    const handled = await handleDirectEntry(ctx, trimmed);
    if (handled) return true;
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

async function handleDirectEntry(
  ctx: RouterContext,
  input: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const numberCandidate = parseNumberAndAmount(input);
  const normalized = normalizeMsisdn(numberCandidate.number) ??
    simpleNormalize(numberCandidate.number);
  if (normalized) {
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
    if (numberCandidate.amount !== undefined) {
      await deliverMomoQr(
        ctx,
        { target: local, targetType: "msisdn", display, e164 },
        numberCandidate.amount,
      );
    } else {
      await promptAmount(ctx, display);
    }
    return true;
  }
  const codeCandidate = parseCodeAndAmount(input);
  if (codeCandidate.code) {
    await setState(ctx.supabase, ctx.profileId, {
      key: STATES.AMOUNT_INPUT,
      data: {
        target: codeCandidate.code,
        targetType: "code",
        display: codeCandidate.code,
      },
    });
    if (codeCandidate.amount !== undefined) {
      await deliverMomoQr(
        ctx,
        {
          target: codeCandidate.code,
          targetType: "code",
          display: codeCandidate.code,
        },
        codeCandidate.amount,
      );
    } else {
      await promptAmount(ctx, codeCandidate.code);
    }
    return true;
  }
  return false;
}

async function handleNumberInput(
  ctx: RouterContext,
  input: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const combined = parseNumberAndAmount(input);
  const normalized = normalizeMsisdn(combined.number) ??
    simpleNormalize(combined.number);
  if (!normalized) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Invalid number. Use digits only (e.g. 07XXXXXXXX).",
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
  if (combined.amount !== undefined) {
    await deliverMomoQr(
      ctx,
      { target: local, targetType: "msisdn", display, e164 },
      combined.amount,
    );
  } else {
    await promptAmount(ctx, display);
  }
  return true;
}

async function handleCodeInput(
  ctx: RouterContext,
  input: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const { code, amount } = parseCodeAndAmount(input);
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
  if (amount !== undefined) {
    await deliverMomoQr(
      ctx,
      { target: code, targetType: "code", display: code },
      amount,
    );
  } else {
    await promptAmount(ctx, code);
  }
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
      buildButtons(
        { id: IDS.MOMO_QR_SKIP, title: "Skip" },
        { id: IDS.MOMO_QR, title: "↩️ Menu" },
      ),
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
  
  // Use QR-optimized encoding for QR codes (unencoded * and # for Android compatibility)
  const qrData = buildMomoUssdForQr(
    targetValue,
    isCode,
    amountRwf ?? undefined,
  );
  
  // Use standard encoding for WhatsApp buttons/links (iOS requirement)
  const buttonData = buildMomoUssd(
    targetValue,
    isCode,
    amountRwf ?? undefined,
  );
  
  const qrUrl = buildQrLink(qrData.telUri);
  const lines: string[] = [
    `Target: ${data.display}`,
    `Dial: ${buttonData.ussd}`,
    `Tap: ${buttonData.telUri}`,
  ];
  if (amountRwf && amountRwf > 0) {
    lines.splice(1, 0, `Amount: RWF ${amountRwf.toLocaleString("en-US")}`);
  }
  const shareLink = buildWaLink(`Pay via MoMo ${data.display}: ${buttonData.ussd}`);
  if (shareLink) {
    lines.push(`Share: ${shareLink}`);
  }
  const messageBody = lines.join("\n");
  const fallbackBody = `${messageBody}\nQR link: ${qrUrl}`;

  let fallbackNeeded = false;

  try {
    await sendImageUrl(ctx.from, qrUrl, `Scan to pay ${data.display}`);
  } catch (error) {
    fallbackNeeded = true;
    const message = error instanceof Error ? error.message : String(error);
    console.error("momo.qr.send_image_fail", message);
  }

  try {
    await sendButtonsMessage(
      ctx,
      messageBody,
      buildButtons({ id: IDS.MOMO_QR, title: "🔁 New QR" }),
    );
  } catch (error) {
    fallbackNeeded = true;
    const message = error instanceof Error ? error.message : String(error);
    console.error("momo.qr.send_buttons_fail", message);
  }

  if (fallbackNeeded) {
    try {
      await sendText(ctx.from, fallbackBody);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("momo.qr.send_text_fail", message);
    }
  }
  const loggedTarget = data.targetType === "msisdn"
    ? data.e164 ?? localToE164(targetValue)
    : targetValue;
  await logMomoQrRequest(ctx.supabase, {
    requesterWaId: ctx.from,
    target: loggedTarget,
    targetType: data.targetType,
    amountMinor: amountRwf && amountRwf > 0 ? amountRwf * 100 : null,
    qrUrl,
    ussd: buttonData.ussd,
    telUri: qrData.telUri,
  });
  await logEvent("MOMO_QR", {
    requester: ctx.from,
    target: loggedTarget,
    target_type: data.targetType,
    amount_minor: amountRwf && amountRwf > 0 ? amountRwf * 100 : null,
  });
  await clearState(ctx.supabase, ctx.profileId!);
}

async function canUseSelfNumber(ctx: RouterContext): Promise<boolean> {
  try {
    const support = await checkCountrySupport(ctx.supabase, ctx.from);
    return support.momoSupported;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("momo.country_support_error", { message });
    return false;
  }
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

function simpleNormalize(raw: string): NormalizedMsisdn | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const local = digits;
  const e164 = digits.startsWith("+") ? digits : `+${digits}`;
  return { local, e164 };
}

function parseNumberAndAmount(
  raw: string,
): { number: string; amount: number | null | undefined } {
  const trimmed = raw.trim();
  if (!trimmed) return { number: raw, amount: null };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { number: trimmed, amount: null };
  }
  for (let i = 1; i < parts.length; i += 1) {
    const amountSlice = parts.slice(parts.length - i).join(" ");
    const parsedAmount = parseAmount(amountSlice);
    if (parsedAmount !== undefined) {
      const numberPart = parts.slice(0, parts.length - i).join(" ").trim();
      if (!numberPart) {
        return { number: trimmed, amount: parsedAmount };
      }
      return { number: numberPart, amount: parsedAmount };
    }
  }
  return { number: trimmed, amount: null };
}

function parseCodeAndAmount(
  raw: string,
): { code: string | null; amount: number | null | undefined } {
  const match = raw.match(/(\d{4,12})/);
  if (!match) return { code: null, amount: null };
  const code = match[1];
  const remainderIndex = (match.index ?? 0) + code.length;
  const remainder = raw.slice(remainderIndex).trim();
  const amount = remainder ? parseAmount(remainder) : null;
  return { code, amount };
}

async function promptAmount(
  ctx: RouterContext,
  display: string,
): Promise<void> {
  await sendButtonsMessage(
    ctx,
    `💰 Enter amount in RWF for ${display} (or tap Skip).`,
    buildButtons({ id: IDS.MOMO_QR_SKIP, title: "Skip" }),
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
  const digits = local.replace(/\D/g, "");
  if (!digits) return local;
  if (digits.startsWith("250")) return `+${digits}`;
  return `+${digits}`;
}
