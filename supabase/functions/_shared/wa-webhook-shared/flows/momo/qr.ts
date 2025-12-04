import type { RouterContext } from "../../types.ts";
import {
  sendImageUrl,
  sendText,
} from "../../wa/client.ts";
import { IDS } from "../../wa/ids.ts";
import { clearState, setState } from "../../state/store.ts";
import { buildMomoUssd, buildMomoUssdForQr } from "../../utils/momo.ts";
import { getMomoProvider } from "../../domains/exchange/country_support.ts";
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
import { encodeTelUri, encodeTelUriForQr } from "../../utils/ussd.ts";

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

// Helper to check country support for MoMo using countries table
import { checkCountrySupport } from "../../domains/exchange/country_support.ts";
async function isMomoSupported(ctx: RouterContext, phone: string): Promise<boolean> {
  try {
    const res = await checkCountrySupport(ctx.supabase as any, phone);
    return res.momoSupported === true;
  } catch (_e) {
    return false;
  }
}

export async function startMomoQr(
  ctx: RouterContext,
  _state: MomoState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  await setState(ctx.supabase, ctx.profileId, { key: STATES.MENU, data: {} });
  
  const isSupported = await isMomoSupported(ctx, ctx.from);
  const selfNumber = normalizeMsisdn(ctx.from);
  
  const rows: any[] = [];

  // Only show "Use my number" if supported country
  if (isSupported && selfNumber) {
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
      const normalized = normalizeMsisdn(ctx.from);
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
    case STATES.MENU:
    case "home": // Also handle phone numbers from home state
    {
      // Be lenient: allow the user to type either a phone number or a merchant code
      const byNumber = parseNumberAndAmount(trimmed);
      const normalized = normalizeMsisdn(byNumber.number) || simpleNormalize(byNumber.number);
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
        if (byNumber.amount != null) {
          await deliverMomoQr(
            ctx,
            { target: local, targetType: "msisdn", display, e164 },
            byNumber.amount,
          );
          return true;
        }
        await promptAmount(ctx, display);
        return true;
      }
      const byCode = parseCodeAndAmount(trimmed);
      if (byCode.code) {
        await setState(ctx.supabase, ctx.profileId, {
          key: STATES.AMOUNT_INPUT,
          data: {
            target: byCode.code,
            targetType: "code",
            display: byCode.code,
          },
        });
        if (byCode.amount != null) {
          await deliverMomoQr(
            ctx,
            { target: byCode.code, targetType: "code", display: byCode.code },
            byCode.amount,
          );
          return true;
        }
        await promptAmount(ctx, byCode.code);
        return true;
      }
      // Not a recognisable input for MoMo QR menu
      return false;
    }
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
  // Support "number amount" in a single message
  const combined = parseNumberAndAmount(input);
  // Relaxed normalization to accept any valid-looking number
  const normalized = normalizeMsisdn(combined.number) || simpleNormalize(combined.number);
  
  if (!normalized) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Invalid number format.",
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
  if (combined.amount != null) {
    await deliverMomoQr(ctx, {
      target: local,
      targetType: "msisdn",
      display,
      e164,
    }, combined.amount);
    return true;
  } else {
    await promptAmount(ctx, display);
    return true;
  }
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
  if (amount != null) {
    await deliverMomoQr(ctx, {
      target: code,
      targetType: "code",
      display: code,
    }, amount);
    return true;
  } else {
    await promptAmount(ctx, code);
    return true;
  }
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
  
  // Try provider-specific USSD format if available.
  // For MSISDN targets, infer provider from the target's country rather than the WhatsApp sender.
  const providerProbeNumber = data.targetType === "msisdn"
    ? (data.e164 ?? localToE164(targetValue))
    : ctx.from;
  const provider = await getMomoProvider(ctx.supabase as any, providerProbeNumber).catch(() => null);
  // Only accept provider formats that contain a placeholder we can fill.
  const format = provider?.ussdFormat && /\{(NUMBER|CODE)\}/.test(provider.ussdFormat)
    ? provider.ussdFormat
    : null; // e.g., *182*8*1*{CODE}# or *182*1*1*{NUMBER}*{AMOUNT}#

  const customUssd = format
    ? buildFromFormat(format, targetValue, isCode, amountRwf ?? undefined)
    : null;

  // Use QR-optimized encoding for QR codes (unencoded * and # for Android compatibility)
  const qrData = customUssd
    ? { ussd: customUssd, telUri: encodeTelUriForQr(customUssd) }
    : buildMomoUssdForQr(targetValue, isCode, amountRwf ?? undefined);
  
  // Use standard encoding for WhatsApp buttons/links (iOS requirement)
  const buttonData = customUssd
    ? { ussd: customUssd, telUri: encodeTelUri(customUssd) }
    : buildMomoUssd(targetValue, isCode, amountRwf ?? undefined);
  
  const qrUrl = buildQrLink(qrData.telUri);
  const lines: string[] = [
    `Target: ${data.display}`,
    provider?.name ? `Provider: ${provider.name}` : undefined,
    amountRwf && amountRwf > 0 ? `Amount: ${amountRwf.toLocaleString('en-US')} RWF` : undefined,
    `Dial: ${buttonData.ussd}`,
  ].filter(Boolean) as string[];
  const shareLink = buildWaLink(`Pay via MoMo ${data.display}: ${buttonData.ussd}`);
  if (shareLink) {
    lines.push(`Share: ${shareLink}`);
  }
  const messageBody = lines.join("\n");
  const fallbackBody = `${messageBody}\nQR link: ${qrUrl}`;

  let qrImageSent = false;
  let buttonsSent = false;

  try {
    const capParts = [
      `Scan to pay ${data.display}`,
      provider?.name ? `via ${provider.name}` : undefined,
      amountRwf && amountRwf > 0 ? `${amountRwf.toLocaleString('en-US')} RWF` : undefined,
    ].filter(Boolean) as string[];
    await sendImageUrl(ctx.from, qrUrl, capParts.join(' • '));
    qrImageSent = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logEvent("MOMO_QR_IMAGE_FAIL", {
      requester: ctx.from,
      error: message,
      qr_url: qrUrl,
    });
  }

  try {
    const finalMessageBody = qrImageSent ? messageBody : `${messageBody}\n\n📱 QR code: ${qrUrl}`;
    await sendButtonsMessage(
      ctx,
      finalMessageBody,
      buildButtons({ id: IDS.MOMO_QR, title: "🔁 New QR" }),
    );
    buttonsSent = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logEvent("MOMO_QR_BUTTONS_FAIL", {
      requester: ctx.from,
      error: message,
    });
  }

  if (!buttonsSent) {
    try {
      await sendText(ctx.from, fallbackBody);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await logEvent("MOMO_QR_TEXT_FAIL", {
        requester: ctx.from,
        error: message,
      });
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

type NormalizedMsisdn = { local: string; e164: string };

function normalizeMsisdn(raw: string): NormalizedMsisdn | null {
  const digitsOnly = raw.replace(/\D/g, "");
  if (!digitsOnly) return null;

  let digits = digitsOnly;
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  // Rwanda specific
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

// Simple normalization for other countries or generic numbers
function simpleNormalize(raw: string): NormalizedMsisdn | null {
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 8) return null;
    return { local: digits, e164: `+${digits}` };
}

function parseNumberAndAmount(raw: string): { number: string; amount: number | null } {
  const parts = raw.trim().split(/\s+/);
  if (parts.length >= 2) {
    const num = parts[0];
    const amt = parseAmount(parts.slice(1).join(" "));
    return { number: num, amount: amt == null ? null : amt };
  }
  return { number: raw, amount: null };
}

function parseCodeAndAmount(raw: string): { code: string | null; amount: number | null } {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 4 || digits.length > 9) return { code: null, amount: null };
  // Try to extract trailing amount if present in raw (e.g., "123456 5000")
  const maybeAmount = parseAmount(raw.replace(digits, "").trim());
  return { code: digits, amount: maybeAmount == null ? null : maybeAmount };
}

async function promptAmount(
  ctx: RouterContext,
  display: string,
): Promise<void> {
  await sendButtonsMessage(
    ctx,
    `💰 Enter amount for ${display} (or tap Skip).`,
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

function buildFromFormat(
  fmt: string,
  target: string,
  isCode: boolean,
  amount?: number | null,
): string {
  const digits = target.replace(/\D/g, "");
  let out = fmt;
  out = out.replace('{CODE}', digits);
  out = out.replace('{NUMBER}', digits);
  if (typeof amount === 'number' && amount > 0) {
    out = out.replace('{AMOUNT}', String(amount));
  } else {
    // If format contains {AMOUNT} but amount missing, strip placeholder and any stray * around it
    out = out.replace('*{AMOUNT}', '').replace('{AMOUNT}', '');
  }
  return out;
}

function localToE164(local: string): string {
  if (!local) return local;
  if (local.startsWith("+")) return local;
  if (local.startsWith("07") && local.length === 10) {
    return `+250${local.slice(1)}`;
  }
  return local.startsWith("250") ? `+${local}` : local;
}
