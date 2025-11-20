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
    whatsappTemplates?: Record<string, {
        intent: string;
        locales: string[];
    }>;
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
export declare function listMarketConfigs(): FarmerMarketConfig[];
export declare function getMarketConfig(code?: string | null): FarmerMarketConfig | undefined;
export declare function matchCommodity(config: FarmerMarketConfig, value: string): CommodityRule | undefined;
export declare function matchVariety(commodity: CommodityRule, value?: string | null): VarietyRule | undefined;
export declare function normalize(value: string): string;
//# sourceMappingURL=index.d.ts.map