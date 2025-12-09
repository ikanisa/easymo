/**
 * Farmer Agent Market Configuration
 * Types and utilities for farmer market matching
 */

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

// Default market configs - can be loaded dynamically or from JSON
const defaultConfigs: FarmerMarketConfig[] = [
  {
    marketCode: 'SN',
    country: 'Senegal',
    currency: 'XOF',
    timezone: 'Africa/Dakar',
    locale: 'fr-SN',
    aliases: ['senegal', 'dakar'],
    allowedCities: ['Dakar', 'Thies', 'Saint-Louis', 'Kaolack', 'Ziguinchor'],
    marketDays: ['Monday', 'Wednesday', 'Friday'],
    commodities: [
      {
        commodity: 'onion',
        synonyms: ['oignon', 'oignons'],
        varieties: [
          {
            code: 'red',
            name: 'Red Onion',
            synonyms: ['rouge'],
            grades: ['A', 'B', 'C'],
            defaultUnit: 'kg',
            allowedUnits: ['kg', 'ton'],
            minOrder: 50
          },
          {
            code: 'white',
            name: 'White Onion',
            synonyms: ['blanc'],
            grades: ['A', 'B', 'C'],
            defaultUnit: 'kg',
            allowedUnits: ['kg', 'ton'],
            minOrder: 50
          }
        ]
      },
      {
        commodity: 'potato',
        synonyms: ['pomme de terre', 'patate'],
        varieties: [
          {
            code: 'standard',
            name: 'Standard Potato',
            grades: ['A', 'B'],
            defaultUnit: 'kg',
            allowedUnits: ['kg', 'ton'],
            minOrder: 100
          }
        ]
      }
    ]
  },
  {
    marketCode: 'GH',
    country: 'Ghana',
    currency: 'GHS',
    timezone: 'Africa/Accra',
    locale: 'en-GH',
    aliases: ['ghana', 'accra'],
    allowedCities: ['Accra', 'Kumasi', 'Tamale', 'Takoradi'],
    marketDays: ['Tuesday', 'Thursday', 'Saturday'],
    commodities: [
      {
        commodity: 'tomato',
        synonyms: ['tomatoes'],
        varieties: [
          {
            code: 'roma',
            name: 'Roma Tomato',
            grades: ['A', 'B'],
            defaultUnit: 'crate',
            allowedUnits: ['crate', 'kg'],
            minOrder: 10
          }
        ]
      }
    ]
  },
  {
    marketCode: 'CI',
    country: 'Ivory Coast',
    currency: 'XOF',
    timezone: 'Africa/Abidjan',
    locale: 'fr-CI',
    aliases: ['ivory coast', 'cote divoire', 'abidjan'],
    allowedCities: ['Abidjan', 'Yamoussoukro', 'Bouake'],
    marketDays: ['Monday', 'Thursday'],
    commodities: [
      {
        commodity: 'cassava',
        synonyms: ['manioc'],
        varieties: [
          {
            code: 'standard',
            name: 'Cassava Root',
            grades: ['A', 'B'],
            defaultUnit: 'kg',
            allowedUnits: ['kg', 'ton'],
            minOrder: 50
          }
        ]
      }
    ]
  }
];

const configMap = new Map<string, FarmerMarketConfig>();
const aliasMap = new Map<string, string>();

// Initialize config maps
for (const config of defaultConfigs) {
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
