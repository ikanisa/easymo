import { classifyVehicle, extractFromImages,VehicleDoc } from "@insure/ocr-extract";
import {
  CoverSelection,
  INSURER_PROFILES,
  InsurerProfile,
  multiPrice,
  MultiQuoteOutput,
  PricingInput,
  PricingOutput,
  UsageType,
  VehicleCategory,
} from "@insure/pricing-engine";
import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import OpenAI from "openai";

import { enqueueOutboundSend } from "./outboundQueue";
import { resolveSecretValue } from "./secrets";
import { maskMsisdn } from "./utils/pii";

import { childLogger } from '@easymo/commons';

const log = childLogger({ service: 'whatsapp-pricing-server' });

type UploadedFile = { mimetype: string; buffer: Buffer };

type DecoratedQuote = PricingOutput & {
  insurerProfile?: InsurerProfile;
  momo?: {
    ussd: string;
    tel: string;
    amount: number;
    reference: string;
  };
};

interface SimulationResult {
  inputs: PricingInput;
  doc: VehicleDoc;
  result: MultiQuoteOutput & { quotes: DecoratedQuote[] };
}

interface SessionState {
  files: UploadedFile[];
  overrides: Record<string, unknown>;
  lastPrompt?: number;
}

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
app.use(express.json({ limit: "5mb" }));

const sessionStore = new Map<string, SessionState>();
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "insure-verify-token";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-RW", { style: "currency", currency: "RWF", maximumFractionDigits: 0 }).format(value);
}

function buildUssdString(profile: InsurerProfile, amount: number, reference?: string): string {
  const referenceValue = reference ?? `${profile.momoReferencePrefix}${Math.floor(Date.now() / 1000).toString().slice(-4)}`;
  return `*182*8*1*${profile.momoMerchantCode}*${Math.round(amount)}*${referenceValue}#`;
}

function quoteToText(quote: DecoratedQuote): string {
  const lines: string[] = [];
  lines.push(`*${quote.providerName}* — Total: *${formatCurrency(quote.grossPremium)}*`);
  quote.breakdown.forEach((item: { label: string; amount?: number | null }) => {
    if (item.amount) lines.push(`• ${item.label}: ${formatCurrency(item.amount)}`);
  });
  const ex = quote.mandatoryExcessApplicable;
  lines.push(
    `_Mandatory excess_: ${Math.round(ex.md_percent_of_claim * 100)}% MD, ${Math.round(ex.theft_fire_percent_total_loss * 100)}% Theft/Fire (min ${formatCurrency(
      ex.minimum_rwf,
    )})`,
  );
  if (quote.momo) lines.push(`MoMo USSD: ${quote.momo.ussd}`);
  else if (quote.insurerProfile) lines.push(`MoMo merchant: ${quote.insurerProfile.momoMerchantCode}`);
  if (quote.warnings?.length) lines.push(`⚠️ ${quote.warnings.join("; ")}`);
  return lines.join("\n");
}

let whatsappTokenPromise: Promise<string | undefined> | null = null;

async function getWhatsAppToken(): Promise<string | undefined> {
  if (!whatsappTokenPromise) {
    whatsappTokenPromise = resolveSecretValue({
      ref:
        process.env.WHATSAPP_TOKEN_SECRET_ARN ??
        process.env.WHATSAPP_TOKEN_SECRET_ID ??
        process.env.FACEBOOK_TOKEN_SECRET_ARN ??
        process.env.FACEBOOK_TOKEN_SECRET_ID ??
        process.env.FACEBOOK_TOKEN_SECRET_NAME ??
        process.env.WHATSAPP_TOKEN_SECRET_NAME ??
        null,
      fallbackEnv: "WHATSAPP_TOKEN",
      label: "whatsapp_token",
      optional: true,
    });
  }
  return whatsappTokenPromise;
}

async function sendWhatsApp(to: string, bodyText: string, phoneIdOverride?: string) {
  const phoneId = phoneIdOverride || process.env.WHATSAPP_PHONE_ID;
  const token = await getWhatsAppToken();

  if (!phoneId || !token) {
    log.warn("whatsapp.send.credentials_missing", {
      hasPhoneId: Boolean(phoneId),
      hasToken: Boolean(token),
    });
    return;
  }

  const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
  const maskedRecipient = maskMsisdn(to);

  try {
    await enqueueOutboundSend(
      { to, type: "text" },
      async () => {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { body: bodyText },
          }),
        });
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`status ${res.status}: ${errorText}`);
        }
      },
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log.error("whatsapp.send.error", {
      to: maskedRecipient,
      reason,
    });
  }
}

function ensureSession(id: string): SessionState {
  if (!sessionStore.has(id)) {
    sessionStore.set(id, { files: [], overrides: {} });
  }
  return sessionStore.get(id)!;
}

function coerceNumber(value: unknown, fallback?: number): number | undefined {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value.replace(/[^0-9.]/g, ""));
    if (!Number.isNaN(numeric)) return numeric;
  }
  return fallback;
}

function coerceBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (["1", "true", "yes", "y"].includes(normalized)) return true;
    if (["0", "false", "no", "n"].includes(normalized)) return false;
  }
  return fallback;
}

function sessionReady(state: SessionState): boolean {
  return state.files.length > 0 && typeof state.overrides.sumInsured === "number" && (state.overrides.sumInsured as number) > 0;
}

function extractTextOverride(text: string): { overrides: Record<string, unknown>; command?: "quote" | "reset" } {
  const overrides: Record<string, unknown> = {};
  const normalized = text.toLowerCase();
  const amountMatch = text.match(/\d[\d.,]{4,}/g);
  if (amountMatch && amountMatch.length) {
    const candidate = Number(amountMatch[amountMatch.length - 1].replace(/[^0-9]/g, ""));
    if (!Number.isNaN(candidate) && candidate > 1000) overrides.sumInsured = candidate;
  }
  if (normalized.includes("comprehensive")) overrides.coverSelection = "COMPREHENSIVE";
  else if (normalized.includes("tp only") || normalized.includes("third party") || normalized.includes("tp ")) overrides.coverSelection = "TP_ONLY";
  if (normalized.includes("comesa")) overrides.wantsComesa = !normalized.includes("no comesa") && !normalized.includes("without comesa");
  const planMatch = normalized.match(/plan\s*(\d)/);
  if (planMatch) overrides.occupantPlan = Number(planMatch[1]);
  const paxMatch = normalized.match(/occupant[s]?\s*(\d+)/) || normalized.match(/seat[s]?\s*(\d+)/);
  if (paxMatch) overrides.occupantCount = Number(paxMatch[1]);
  const periodMatch = normalized.match(/(\d+)\s*(day|month)/);
  if (periodMatch) {
    const value = Number(periodMatch[1]);
    overrides.periodDays = normalized.includes("month") ? value * 30 : value;
  }
  if (normalized.includes("flammable")) overrides.goodsAreFlammable = true;
  if (normalized.includes("reset")) return { overrides: {}, command: "reset" };
  if (normalized.includes("quote") || normalized.includes("ready") || normalized.includes("run")) return { overrides, command: "quote" };
  return { overrides };
}

function describeMissing(state: SessionState): string {
  if (!state.files.length) return "Upload the logbook / yellow card so I can extract the data.";
  if (typeof state.overrides.sumInsured !== "number") return "Share the Sum Insured (amount) so I can finish the quote.";
  return "Type 'quote' when you want me to run the comparison.";
}

function extractMessageText(message: any): string | undefined {
  if (message.text?.body) return message.text.body;
  if (message.interactive?.list_reply?.title) return message.interactive.list_reply.title;
  if (message.interactive?.button_reply?.title) return message.interactive.button_reply.title;
  if (message.button?.text) return message.button.text;
  return undefined;
}

async function downloadMedia(mediaId: string): Promise<UploadedFile | undefined> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) return undefined;
  const infoRes = await fetch(`https://graph.facebook.com/v20.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!infoRes.ok) {
    log.error("Failed to fetch media metadata", await infoRes.text());
    return undefined;
  }
  const info = (await infoRes.json()) as { url: string; mime_type: string };
  const url = info.url;
  const mediaRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!mediaRes.ok) {
    log.error("Failed to download media", await mediaRes.text());
    return undefined;
  }
  const buffer = Buffer.from(await mediaRes.arrayBuffer());
  return { mimetype: info.mime_type, buffer };
}

async function runQuotePipeline(files: UploadedFile[], overrides: Record<string, unknown>): Promise<SimulationResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const imageUrls = files.map((file) => `data:${file.mimetype};base64,${file.buffer.toString("base64")}`);
  const doc: VehicleDoc = imageUrls.length ? await extractFromImages(openai, imageUrls) : ({} as VehicleDoc);
  const { vehicleCategory, usageTypeGuess } = classifyVehicle(doc);

  const seats = doc.seats ?? coerceNumber(overrides.seats, 5) ?? 5;
  const paxAbove = doc.passengersAboveDriver ?? coerceNumber(overrides.passengerSeatsAboveDriver, Math.max(seats - 1, 0)) ?? Math.max(seats - 1, 0);
  const providedAge = coerceNumber(overrides.vehicleAgeYears);
  const derivedAge = doc.year ? Math.max(0, new Date().getFullYear() - doc.year) : undefined;
  const vehicleAgeYears = providedAge ?? derivedAge ?? 5;

  const resolvedVehicleCategory = (overrides.vehicleCategory as VehicleCategory) ?? vehicleCategory ?? "CAR";
  const resolvedUsage = (overrides.usageType as UsageType) ?? usageTypeGuess ?? "PRIVATE";

  const wantsComesaFlag = typeof overrides.wantsComesa !== "undefined"
    ? coerceBoolean(overrides.wantsComesa)
    : doc.usageHint === "COMMERCIAL_GOODS";

  const baseInput: PricingInput = {
    sumInsured: doc.sumInsuredHint || coerceNumber(overrides.sumInsured, 20_000_000) || 20_000_000,
    vehicleCategory: resolvedVehicleCategory,
    usageType: resolvedUsage,
    seats,
    passengerSeatsAboveDriver: paxAbove,
    ownerType: (doc.ownerType || overrides.ownerType || "INDIVIDUAL") as PricingInput["ownerType"],
    vehicleAgeYears,
    coverSelection: ((overrides.coverSelection as CoverSelection) || "COMPREHENSIVE") as PricingInput["coverSelection"],
    wantsComesa: wantsComesaFlag,
    comesaPassengers: coerceNumber(overrides.comesaPassengers, paxAbove) || paxAbove,
    theftTerritorialExtension: coerceBoolean(overrides.theftTerritorialExtension),
    periodDays: coerceNumber(overrides.periodDays, 365) || 365,
    goodsAreFlammable: coerceBoolean(overrides.goodsAreFlammable),
    governmentExcessWaiver: coerceBoolean(overrides.governmentExcessWaiver),
  };

  const occupantEnabled =
    coerceBoolean(overrides.occupantEnabled) || typeof overrides.occupantPlan !== "undefined" || typeof overrides.occupantCount !== "undefined";
  if (occupantEnabled) {
    baseInput.occupantCover = {
      enabled: true,
      plan: (coerceNumber(overrides.occupantPlan, 1) || 1) as 1 | 2 | 3 | 4 | 5,
      occupants: coerceNumber(overrides.occupantCount, paxAbove) || paxAbove,
      vehicleIsMotorcycle: baseInput.vehicleCategory === "MOTORCYCLE",
      usageType: baseInput.usageType,
    };
  }

  const multi = multiPrice(baseInput);
  const decoratedQuotes: DecoratedQuote[] = multi.quotes.map((quote: PricingOutput) => {
    const profile = INSURER_PROFILES[quote.providerName];
    if (!profile) return quote;
    const reference = `${profile.momoReferencePrefix}${Math.floor(Date.now() / 1000).toString().slice(-4)}`;
    const ussd = buildUssdString(profile, quote.grossPremium, reference);
    return {
      ...quote,
      insurerProfile: profile,
      momo: {
        ussd,
        tel: `tel:${encodeURI(ussd)}`,
        amount: quote.grossPremium,
        reference,
      },
    };
  });

  return { inputs: baseInput, doc, result: { ...multi, quotes: decoratedQuotes } };
}

async function triggerQuote(to: string, session: SessionState, phoneId?: string) {
  if (!sessionReady(session)) {
    await sendWhatsApp(to, describeMissing(session), phoneId);
    return;
  }
  const simulation = await runQuotePipeline(session.files, session.overrides);
  const text = simulation.result.quotes.map(quoteToText).join("\n\n");
  await sendWhatsApp(to, text, phoneId);
  session.lastPrompt = Date.now();
}

function attachOverrides(session: SessionState, overrides: Record<string, unknown>) {
  session.overrides = { ...session.overrides, ...overrides };
}

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post("/webhook", async (req, res) => {
  try {
    const entries = req.body.entry || [];
    for (const entry of entries) {
      const change = entry.changes?.[0];
      if (!change?.value?.messages) continue;
      const phoneId = change.value.metadata?.phone_number_id || process.env.WHATSAPP_PHONE_ID;
      for (const message of change.value.messages) {
        const from = message.from;
        const session = ensureSession(from);

        const mediaId = message.image?.id || message.document?.id;
        if (mediaId) {
          const file = await downloadMedia(mediaId);
          if (file) {
            session.files.push(file);
            await sendWhatsApp(from, "Document received. Share the Sum Insured figure or type 'quote' when ready.", phoneId);
          }
        }

        const text = extractMessageText(message);
        if (text) {
          const { overrides, command } = extractTextOverride(text);
          if (command === "reset") {
            sessionStore.set(from, { files: [], overrides: {} });
            await sendWhatsApp(from, "Session reset. Send the new documents anytime.", phoneId);
            continue;
          }
          attachOverrides(session, overrides);
          if (overrides.sumInsured) {
            await sendWhatsApp(from, `Sum Insured noted: ${formatCurrency(overrides.sumInsured as number)}. Type 'quote' when ready.`, phoneId);
          }
          if (command === "quote") {
            await triggerQuote(from, session, phoneId);
            continue;
          }
        }

        if (sessionReady(session) && (Date.now() - (session.lastPrompt || 0) > 30_000)) {
          await sendWhatsApp(from, "All inputs received. Type 'quote' to run the comparison.", phoneId);
          session.lastPrompt = Date.now();
        }
      }
    }
    res.sendStatus(200);
  } catch (err) {
    log.error("Webhook processing error", err);
    res.sendStatus(500);
  }
});

app.post("/simulate", upload.array("files"), async (req, res) => {
  try {
    const to = (req.body.to as string) || "";
    const uploadedFiles: UploadedFile[] = ((req.files as Express.Multer.File[]) || []).map((file) => ({
      mimetype: file.mimetype,
      buffer: file.buffer,
    }));
    const simulation = await runQuotePipeline(uploadedFiles, req.body ?? {});

    if (to) {
      const text = simulation.result.quotes.map(quoteToText).join("\n\n");
      await sendWhatsApp(to, text);
    }

    res.json(simulation);
  } catch (error) {
    log.error(error);
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get("/paylink", (req, res) => {
  const providerName = String(req.query.provider || "");
  const profile = INSURER_PROFILES[providerName];
  if (!profile) {
    res.status(404).json({ error: "Unknown provider" });
    return;
  }
  const amount = coerceNumber(req.query.amount);
  if (!amount) {
    res.status(400).json({ error: "amount is required" });
    return;
  }
  const reference = String(req.query.reference || `${profile.momoReferencePrefix}${Math.floor(Date.now() / 1000).toString().slice(-4)}`);
  const ussd = buildUssdString(profile, amount, reference);
  res.json({
    providerName: profile.providerName,
    amount: Math.round(amount),
    reference,
    ussd,
    tel: `tel:${encodeURI(ussd)}`,
    profile,
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  log.info(`WhatsApp pricing server listening on ${PORT}`);
});
