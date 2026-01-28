import ciConfig from './ci-abidjan.json' assert { type: 'json' };
import ghConfig from './gh-accra.json' assert { type: 'json' };
import snConfig from './sn-dakar.json' assert { type: 'json' };

export type FarmerMarketConfig = {
  marketCode: string;
  country: string;
  currency: string;
  timezone: string;
  locale: string;
  aliases?: string[];
  allowedCities: string[];
  marketDays: string[];
  alertLeadHours?: number[];
  commodities: CommodityRule[];
  codFallback?: CodFallbackRule;
  whatsappTemplates?: Record<string, { intent: string; locales: string[] }>;
};

export type CommodityRule = {
  commodity: string;
  synonyms?: string[];
  varieties: VarietyRule[];
};

export type VarietyRule = {
  code: string;
  name: string;
  synonyms?: string[];
  grades: string[];
  defaultUnit: string;
  allowedUnits: string[];
  minOrder: number;
};

export type CodFallbackRule = {
  enabled: boolean;
  requiresConfirmation?: boolean;
  instructions: string;
};

const rawConfigs = [snConfig, ghConfig, ciConfig] as unknown as FarmerMarketConfig[];
const configMap = new Map<string, FarmerMarketConfig>();
const aliasMap = new Map<string, string>();

for (const config of rawConfigs) {
  configMap.set(config.marketCode.toLowerCase(), config);
  if (config.aliases) {
    for (const alias of config.aliases) {
      aliasMap.set(alias.toLowerCase(), config.marketCode.toLowerCase());
    }
  }
}

export function listMarketConfigs(): FarmerMarketConfig[] {
  return Array.from(configMap.values());
}

export function getMarketConfig(code?: string | null): FarmerMarketConfig | undefined {
  if (!code) return undefined;
  const normalized = code.toLowerCase();
  const resolvedCode = aliasMap.get(normalized) ?? normalized;
  return configMap.get(resolvedCode);
}

export function matchCommodity(config: FarmerMarketConfig, value: string): CommodityRule | undefined {
  const normalized = normalize(value);
  return config.commodities.find((commodity) => {
    if (normalize(commodity.commodity) === normalized) return true;
    return commodity.synonyms?.some((syn) => normalize(syn) === normalized);
  });
}

export function matchVariety(
  commodity: CommodityRule,
  value?: string | null,
): VarietyRule | undefined {
  if (!value) return commodity.varieties[0];
  const normalized = normalize(value);
  return commodity.varieties.find((variety) => {
    if (normalize(variety.code) === normalized) return true;
    if (normalize(variety.name) === normalized) return true;
    return variety.synonyms?.some((syn) => normalize(syn) === normalized);
  });
}

export function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
