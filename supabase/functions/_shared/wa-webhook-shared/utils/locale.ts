import { detectToneLocale } from "../../../../packages/localization/src/detection.ts";
import type { DetectionResult, ToneLocale } from "../../../../packages/localization/src/index.ts";
import { mapToneLocaleToLanguage } from "../../../../packages/localization/src/tone.ts";
import type { SupportedLanguage } from "../i18n/language.ts";
import { coerceToSupportedLanguage } from "../i18n/language.ts";
import type {
  WhatsAppContact,
  WhatsAppMessage,
  WhatsAppWebhookChange,
} from "../types.ts";

export type ContactChange = Pick<WhatsAppWebhookChange, "value">;

export function normalizeWaId(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) return "";
  const collapsed = trimmed.replace(/\s+/g, "");
  const digits = collapsed.replace(/[^0-9]/g, "");
  if (digits.length > 0) {
    return `+${digits}`;
  }
  const withoutLeadingPlus = collapsed.replace(/^\++/, "");
  if (!withoutLeadingPlus) return "";
  return `+${withoutLeadingPlus}`;
}

export function normalizeDisplayNumber(number: string): string {
  const trimmed = number.trim();
  if (!trimmed) return trimmed;
  const digits = trimmed.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
}

export function buildContactLocaleIndex(
  changes: ContactChange[],
): Map<string, string> {
  const index = new Map<string, string>();
  for (const change of changes ?? []) {
    const contacts = Array.isArray(change?.value?.contacts)
      ? change.value.contacts
      : [];
    for (const contact of contacts) {
      if (!isContactRecord(contact)) continue;
      const waIdRaw = getStringField(contact, "wa_id") ??
        getStringField(contact, "waId");
      if (!waIdRaw) continue;
      const localeCandidate = extractLocaleCandidate(contact);
      if (!localeCandidate) continue;
      const normalizedNumber = normalizeWaId(waIdRaw);
      if (!normalizedNumber) continue;
      index.set(normalizedNumber, localeCandidate);
      index.set(normalizedNumber.replace(/^\+/, ""), localeCandidate);
    }
  }
  return index;
}

export type MessageLanguageDetection = {
  language: SupportedLanguage | null;
  toneLocale: ToneLocale;
  toneDetection: DetectionResult;
};

export function detectMessageLanguage(
  msg: WhatsAppMessage,
  contactLocales: Map<string, string>,
): MessageLanguageDetection {
  const bodyText = extractBodyText(msg);
  const toneDetection = detectToneLocale(bodyText);
  const toneLocale = toneDetection.locale;

  const directCandidates = [
    msg?.language?.code,
    msg?.language,
    msg?.context?.language,
    msg?.context?.locale,
  ];
  for (const candidate of directCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      const supported = coerceToSupportedLanguage(candidate.trim());
      if (supported) {
        return { language: supported, toneLocale, toneDetection };
      }
    }
  }

  if (typeof msg?.from !== "string" || !msg.from.trim()) {
    return {
      language: coerceToSupportedLanguage(mapToneLocaleToLanguage(toneLocale)),
      toneLocale,
      toneDetection,
    };
  }
  const normalized = normalizeWaId(msg.from.trim());
  const match = contactLocales.get(normalized) ??
    contactLocales.get(normalized.replace(/^\+/, "")) ??
    null;
  const resolved = match
    ? coerceToSupportedLanguage(match)
    : coerceToSupportedLanguage(mapToneLocaleToLanguage(toneLocale));
  return { language: resolved, toneLocale, toneDetection };
}

function extractBodyText(msg: WhatsAppMessage): string | null {
  if (msg?.type === "text" && typeof msg?.text?.body === "string") {
    return msg.text.body;
  }
  if (msg?.type === "interactive") {
    const listTitle = msg?.interactive?.list_reply?.title || msg?.interactive?.list_reply?.description;
    if (typeof listTitle === "string") return listTitle;
    const buttonTitle = msg?.interactive?.button_reply?.title;
    if (typeof buttonTitle === "string") return buttonTitle;
  }
  return null;
}

function isContactRecord(contact: unknown): contact is WhatsAppContact {
  return Boolean(contact) && typeof contact === "object";
}

function getStringField(
  source: Record<string, unknown> | undefined,
  key: string,
): string | null {
  if (!source) return null;
  const value = source[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function extractLocaleCandidate(
  contact: WhatsAppContact,
): string | null {
  const profile = ("profile" in contact && contact.profile &&
      typeof contact.profile === "object")
    ? contact.profile as Record<string, unknown>
    : undefined;
  const candidates = [
    getStringField(profile, "language"),
    getStringField(profile, "locale"),
    getStringField(contact, "language"),
    getStringField(contact, "locale"),
  ];
  for (const candidate of candidates) {
    if (candidate) return candidate;
  }
  return null;
}
