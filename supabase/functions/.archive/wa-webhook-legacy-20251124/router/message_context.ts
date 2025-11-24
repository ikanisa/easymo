import type { SupabaseClient } from "../deps.ts";
import type { RouterContext, WhatsAppMessage } from "../types.ts";
import type { ChatState } from "../state/store.ts";
import { ensureProfile, getState, InvalidWhatsAppNumberError } from "../state/store.ts";
import {
  detectMessageLanguage,
  type MessageLanguageDetection,
  normalizeWaId,
} from "../utils/locale.ts";
import { resolveLanguage } from "../i18n/language.ts";
import { logMetric } from "../observe/logging.ts";
import type { SupportedLanguage } from "../i18n/language.ts";
import type {
  DetectionResult,
  ToneLocale,
} from "../../../../packages/localization/src/index.ts";

export type MessageContextResult = {
  context: RouterContext;
  state: ChatState;
  language: SupportedLanguage | null;
  toneLocale: ToneLocale;
  toneDetection: DetectionResult;
};

type MessageContextHooks = {
  ensureProfile: typeof ensureProfile;
  getState: typeof getState;
  detectMessageLanguage: typeof detectMessageLanguage;
  normalizeWaId: typeof normalizeWaId;
  resolveLanguage: typeof resolveLanguage;
  logMetric: typeof logMetric;
};

const defaultHooks: MessageContextHooks = {
  ensureProfile,
  getState,
  detectMessageLanguage,
  normalizeWaId,
  resolveLanguage,
  logMetric,
};

let hooks: MessageContextHooks = { ...defaultHooks };

export function __setMessageContextTestOverrides(
  overrides: Partial<MessageContextHooks>,
): void {
  hooks = { ...hooks, ...overrides };
}

export function __resetMessageContextTestOverrides(): void {
  hooks = { ...defaultHooks };
}

export async function buildMessageContext(
  supabase: SupabaseClient,
  message: WhatsAppMessage,
  contactLocales: Map<string, string>,
): Promise<MessageContextResult | null> {
  const normalizedFrom = hooks.normalizeWaId(message.from);
  const detection: MessageLanguageDetection =
    hooks.detectMessageLanguage(message, contactLocales);
  const messageLanguage = detection.language;

  let profile;
  try {
    profile = await hooks.ensureProfile(
      supabase,
      normalizedFrom,
      messageLanguage ?? undefined,
    );
  } catch (error) {
    if (error instanceof InvalidWhatsAppNumberError) {
      await hooks.logMetric("wa_message_invalid_sender", 1, {});
      return null;
    }
    throw error;
  }

  const resolvedLocale = hooks.resolveLanguage(
    messageLanguage ?? undefined,
    profile.locale ?? undefined,
  );
  const state = await hooks.getState(supabase, profile.user_id);
  const from = profile.whatsapp_e164 ?? normalizedFrom;

  return {
    context: {
      supabase,
      from,
      profileId: profile.user_id,
      locale: resolvedLocale,
      toneLocale: detection.toneLocale,
      toneDetection: detection.toneDetection,
    },
    state,
    language: messageLanguage,
    toneLocale: detection.toneLocale,
    toneDetection: detection.toneDetection,
  };
}
