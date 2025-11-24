type CurrencyPreset = {
  prefixes: string[];
  code: string;
  symbol: string;
  decimals: number;
};

const DEFAULT_PRESET: CurrencyPreset = {
  prefixes: [],
  code: "USD",
  symbol: "$",
  decimals: 2,
};

const PRESETS: CurrencyPreset[] = [
  {
    prefixes: ["+250"],
    code: "RWF",
    symbol: "FRw",
    decimals: 0,
  },
  {
    prefixes: ["+254"],
    code: "KES",
    symbol: "KSh",
    decimals: 0,
  },
  {
    prefixes: ["+233"],
    code: "GHS",
    symbol: "GH₵",
    decimals: 2,
  },
  {
    prefixes: ["+234"],
    code: "NGN",
    symbol: "₦",
    decimals: 2,
  },
  {
    prefixes: ["+356"],
    code: "EUR",
    symbol: "€",
    decimals: 2,
  },
];

export type CurrencyPreference = {
  prefixes?: string[];
  code: string;
  symbol: string;
  decimals: number;
};

export function resolveUserCurrency(msisdn?: string | null): CurrencyPreference {
  if (msisdn) {
    const normalized = msisdn.trim();
    for (const preset of PRESETS) {
      if (preset.prefixes.some((prefix) => normalized.startsWith(prefix))) {
        return preset;
      }
    }
  }
  return DEFAULT_PRESET;
}

export function getCurrencyByCode(code?: string | null): CurrencyPreference {
  if (!code) return DEFAULT_PRESET;
  const normalized = code.trim().toUpperCase();
  const match = PRESETS.find((preset) => preset.code === normalized);
  if (match) return match;
  return {
    code: normalized,
    symbol: DEFAULT_PRESET.symbol,
    decimals: DEFAULT_PRESET.decimals,
  };
}

export function describeCurrency(pref: CurrencyPreference): string {
  return pref.symbol ? `${pref.symbol} (${pref.code})` : pref.code;
}

export function formatCurrencyFromInput(
  value: string | number,
  pref: CurrencyPreference,
): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  const candidate = typeof value === "number" && Number.isFinite(value)
    ? value
    : Number(trimmed.replace(/[, ]/g, ""));

  if (Number.isFinite(candidate)) {
    try {
      const formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: pref.code,
        maximumFractionDigits: pref.decimals,
      });
      return formatter.format(candidate);
    } catch {
      // Fall back below
    }
  }

  return trimmed ? `${trimmed} ${pref.code}` : pref.code;
}
