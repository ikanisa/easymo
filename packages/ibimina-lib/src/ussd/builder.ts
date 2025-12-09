import {
  getDefaultUssdOperator,
  getUssdOperatorById,
  ussdConfig,
  type UssdLocaleDefinition,
  type UssdOperatorConfig,
} from "@ibimina/config";

export type UssdPlatform = "android" | "ios" | "web";

export interface BuildUssdPayloadInput {
  merchantCode: string;
  amount?: number;
  reference?: string;
  operatorId?: string;
  operator?: UssdOperatorConfig;
  locale?: string;
  platform?: UssdPlatform;
  allowAutoDial?: boolean;
  versionOverride?: string;
  ttlSecondsOverride?: number;
}

export interface UssdPayload {
  code: string;
  telUri?: string;
  copyText: string;
  ctaLabel: string;
  instructions: string[];
  formattedAmount?: string;
  operator: UssdOperatorConfig;
  locale: string;
  version: string;
  ttlSeconds: number;
  expiresAt: string;
  canAutoDial: boolean;
}

function pickLocale(
  operator: UssdOperatorConfig,
  localePreference?: string
): { locale: string; definition: UssdLocaleDefinition } {
  if (localePreference) {
    const normalized = localePreference.toLowerCase();
    const match = Object.entries(operator.locales).find(
      ([key]) => key.toLowerCase() === normalized
    );

    if (match) {
      return { locale: match[0], definition: match[1] };
    }
  }

  const [locale, definition] = Object.entries(operator.locales)[0];
  return { locale, definition };
}

function formatAmount(
  amount: number | undefined,
  locale: string,
  currency: string
): string | undefined {
  if (amount == null) {
    return undefined;
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Fallback to simple numeric formatting
    return `${amount} ${currency}`;
  }
}

function interpolate(template: string, replacements: Record<string, string | undefined>): string {
  return template.replace(/\{(code|amount|reference)\}/gi, (match, key) => {
    const replacementKey = key.toLowerCase() as keyof typeof replacements;
    const value = replacements[replacementKey];
    return value ?? match;
  });
}

function buildCode(operator: UssdOperatorConfig, merchantCode: string, amount?: number): string {
  const baseTemplate = amount != null ? operator.templates.shortcut : operator.templates.menu;
  return baseTemplate
    .replace(operator.placeholders.merchant, merchantCode)
    .replace(operator.placeholders.amount, amount != null ? String(amount) : "");
}

export function buildUssdPayload(input: BuildUssdPayloadInput): UssdPayload {
  const operator =
    input.operator ??
    (input.operatorId
      ? (getUssdOperatorById(input.operatorId) ?? getDefaultUssdOperator())
      : getDefaultUssdOperator());

  const { locale, definition } = pickLocale(operator, input.locale);
  const code = buildCode(operator, input.merchantCode, input.amount);
  const formattedAmount = formatAmount(input.amount, locale, operator.currency);
  const replacements: Record<string, string | undefined> = {
    code,
    amount: formattedAmount,
    reference: input.reference,
  };

  const allowAutoDial = input.allowAutoDial ?? true;
  const platform = input.platform ?? "web";
  const canAutoDial = allowAutoDial && platform === "android" && operator.supportsAutoDial;

  const telUri = canAutoDial ? `tel:${encodeURIComponent(code)}` : undefined;

  const instructions = definition.instructions.map((line: string) =>
    interpolate(line, replacements)
  );
  const copyText = interpolate(definition.copy, replacements);
  const ctaLabel = definition.cta;

  const ttlSeconds = input.ttlSecondsOverride ?? ussdConfig.ttlSeconds;
  const ttlMs = ttlSeconds * 1000;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  return {
    code,
    telUri,
    copyText,
    ctaLabel,
    instructions,
    formattedAmount,
    operator,
    locale,
    version: input.versionOverride ?? ussdConfig.version,
    ttlSeconds,
    expiresAt,
    canAutoDial,
  };
}
