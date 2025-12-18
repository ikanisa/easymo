import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";
import { sendTextMessage, sendButtonsMessage, sendListMessage } from "../../_shared/wa-webhook-shared/utils/reply.ts";
import { sendImageUrl } from "../../_shared/wa-webhook-shared/wa/client.ts";
import { IDS } from "../../_shared/wa-webhook-shared/wa/ids.ts";
import { setState, clearState } from "../../_shared/wa-webhook-shared/state/store.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { maskPhone, normalizePhone } from "../../_shared/phone-utils.ts";
import type { SupabaseClient } from "../../_shared/wa-webhook-shared/deps.ts";

const STATE_MOMO_CHOICE = "MOMO_WAIT_CHOICE";
const STATE_MOMO_VALUE = "MOMO_WAIT_VALUE";
const MTN_RW_PREFIX = "+2507";

/**
 * MoMo QR Code - TWO STEPS ONLY
 * Step 1: Choice (use my number or send number/code)
 * Step 2: Input validation and QR generation
 */
export async function handleMomoQr(
  ctx: RouterContext,
  text: string,
  state: { key: string; data?: Record<string, unknown> },
): Promise<boolean> {
  if (!ctx.profileId) return false;

  // Step 1: Show choice menu
  if (state.key !== STATE_MOMO_CHOICE && state.key !== STATE_MOMO_VALUE) {
    return await showMomoChoice(ctx);
  }

  // Handle choice selection (from button click or text)
  if (state.key === STATE_MOMO_CHOICE) {
    const normalized = text.trim().toLowerCase();
    const isMtnRw = ctx.from.startsWith(MTN_RW_PREFIX);
    
    // Handle button clicks: IDS.MOMO_QR_MY or text like "1", "use my", etc.
    if (isMtnRw && (text === IDS.MOMO_QR_MY || normalized === "1" || normalized.includes("use") || normalized.includes("my"))) {
      // Use WhatsApp number
      const phone = normalizePhone(ctx.from);
      if (!phone) {
        await sendTextMessage(
          ctx,
          `❌ *Number Not Found*\n\n` +
          `I couldn't read your WhatsApp number. 😔\n\n` +
          `💡 Please choose option 2 and send your MoMo number or code manually.`,
        );
        return await showMomoChoice(ctx);
      }
      
      await clearState(ctx.supabase, ctx.profileId);
      return await generateAndSendQr(ctx, phone, "number", maskPhone(phone), null);
    } else if (text === IDS.MOMO_QR_NUMBER || normalized === "2" || normalized.includes("send")) {
      // Ask for number/code
      await setState(ctx.supabase, ctx.profileId, {
        key: STATE_MOMO_VALUE,
        data: {},
      });
      
      await sendTextMessage(
        ctx,
        `📱 *Enter MoMo Details*\n\n` +
        `Send your MoMo number or code:\n\n` +
        `*MoMo Number:*\n` +
        `• Format: 07xxxxxxxx or +2507xxxxxxxx\n` +
        `• Example: 0788123456\n\n` +
        `*MoMo Code:*\n` +
        `• Format: 4-9 digits only\n` +
        `• Example: 12345\n\n` +
        `💡 I'll generate a QR code you can share for payments!`,
      );
      return true;
    } else {
      // Invalid choice, show menu again
      return await showMomoChoice(ctx);
    }
  }

  // Step 2: Validate input and generate QR
  if (state.key === STATE_MOMO_VALUE) {
    const parsed = parseMomoInput(text);
    
    if (!parsed.valid) {
      await sendTextMessage(
        ctx,
        `❌ *Invalid Format*\n\n` +
        `I couldn't recognize that format. 😔\n\n` +
        `*Please send:*\n` +
        `• MoMo number: 07xxxxxxxx or +2507xxxxxxxx\n` +
        `• MoMo code: 4-9 digits only\n\n` +
        `*Examples:*\n` +
        `• 0788123456 (number)\n` +
        `• 12345 (code)\n\n` +
        `Try again! 💪`,
      );
      return true;
    }

    const target = parsed.isCode ? parsed.code! : parsed.number!;
    const display = parsed.isCode ? parsed.code! : maskPhone(parsed.number!);
    const amount = parsed.amount ?? null;
    
    await clearState(ctx.supabase, ctx.profileId);
    return await generateAndSendQr(ctx, target, parsed.isCode ? "code" : "number", display, amount);
  }

  return false;
}

/**
 * Show choice menu (Step 1)
 */
async function showMomoChoice(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: STATE_MOMO_CHOICE,
    data: {},
  });

  const isMtnRw = ctx.from.startsWith(MTN_RW_PREFIX);

  const rows = isMtnRw
    ? [
      {
        id: IDS.MOMO_QR_MY,
        title: "1️⃣ Use my WhatsApp number",
        description: `Use ${maskPhone(ctx.from)}`,
      },
      {
        id: IDS.MOMO_QR_NUMBER,
        title: "2️⃣ Send MoMo number / code",
        description: "Provide a different number or code",
      },
      {
        id: "PROFILE",
        title: "← Back to Profile",
        description: "",
      },
    ]
    : [
      {
        id: IDS.MOMO_QR_NUMBER,
        title: "1️⃣ Send MoMo number / code",
        description: "MTN Rwanda numbers only (07xxxxxxxx)",
      },
      {
        id: "PROFILE",
        title: "← Back to Profile",
        description: "",
      },
    ];

  await sendListMessage(
    ctx,
    {
      title: "💳 MoMo QR Code",
      body: "Choose an option:",
      sectionTitle: "Options",
      buttonText: "Select",
      rows,
    },
  );

  return true;
}

/**
 * Generate and send QR code
 */
async function generateAndSendQr(
  ctx: RouterContext,
  target: string,
  targetType: "number" | "code",
  display: string,
  amount: number | null,
): Promise<boolean> {
  // Build USSD template
  const ussd = buildUssd(target, targetType === "code", amount);
  
  // Build QR payload (easyMO deeplink)
  const qrPayload = `https://easymo.app/pay/momo?toType=${targetType}&to=${encodeURIComponent(target)}${amount ? `&amount=${amount}` : ""}`;
  
  // Generate QR code image
  const qrUrl = `https://quickchart.io/qr?size=512&margin=2&text=${encodeURIComponent(qrPayload)}`;
  
  // Build message with USSD template
  const message = `💳 *MoMo QR Code*\n\n` +
    `Target: ${display}\n` +
    `USSD: \`${ussd.human}\`\n\n` +
    `Scan the QR code to pay, or dial the USSD code manually.`;
  
  try {
    // Send QR image
    await sendImageUrl(ctx.from, qrUrl, `MoMo QR for ${display}`);
    
    // Send text with USSD template
    await sendButtonsMessage(
      ctx,
      message,
      [
        { id: IDS.MOMO_QR, title: "🔁 New QR" },
        { id: "PROFILE", title: "← Back" },
      ],
    );
  } catch (error) {
    // Fallback if image fails
    await sendTextMessage(
      ctx,
      `${message}\n\n📱 QR Code: ${qrUrl}`,
    );
  }

  // Log request
  await logStructuredEvent("MOMO_QR_GENERATED", {
    userId: ctx.profileId,
    target,
    targetType,
    amount,
    from: ctx.from,
  });

  return true;
}

/**
 * Parse MoMo input (number or code, optional amount)
 */
function parseMomoInput(input: string): {
  valid: boolean;
  isCode: boolean;
  number?: string;
  code?: string;
  amount?: number | null;
} {
  const trimmed = input.trim();
  const parts = trimmed.split(/\s+/);
  
  // Extract amount if present (last numeric part)
  let amount: number | null = null;
  let inputPart = trimmed;
  
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1];
    const parsedAmount = parseInt(lastPart.replace(/\D/g, ""), 10);
    if (!isNaN(parsedAmount) && parsedAmount > 0) {
      amount = parsedAmount;
      inputPart = parts.slice(0, -1).join(" ");
    }
  }

  // Normalize: trim spaces, remove hyphens
  const normalized = inputPart.replace(/[\s-]/g, "");
  const digits = normalized.replace(/\D/g, "");

  // Check if it's a code (4-9 digits only)
  if (/^\d{4,9}$/.test(digits)) {
    return {
      valid: true,
      isCode: true,
      code: digits,
      amount,
    };
  }

  // Try as phone number
  const phone = normalizePhone(normalized);
  if (phone) {
    return {
      valid: true,
      isCode: false,
      number: phone,
      amount,
    };
  }

  return { valid: false, isCode: false };
}

// normalizePhone is now imported from shared phone-utils

/**
 * Build USSD code
 */
function buildUssd(target: string, isCode: boolean, amount: number | null): {
  human: string;
  telUri: string;
} {
  const digits = target.replace(/\D/g, "");
  const amtSegment = amount ? `*${amount}` : "";
  
  const ussd = isCode
    ? `*182*8*1*${digits}${amtSegment}#`
    : `*182*1*1*${digits}${amtSegment}#`;

  return {
    human: ussd,
    telUri: `tel:${encodeURIComponent(ussd)}`,
  };
}
