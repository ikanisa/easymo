import ciConfig from './ci-abidjan.json' assert { type: 'json' };
import ghConfig from './gh-accra.json' assert { type: 'json' };
import snConfig from './sn-dakar.json' assert { type: 'json' };
const rawConfigs = [snConfig, ghConfig, ciConfig];
const configMap = new Map();
const aliasMap = new Map();
for (const config of rawConfigs) {
    configMap.set(config.marketCode.toLowerCase(), config);
    if (config.aliases) {
        for (const alias of config.aliases) {
            aliasMap.set(alias.toLowerCase(), config.marketCode.toLowerCase());
        }
    }
}
export function listMarketConfigs() {
    return Array.from(configMap.values());
}
export function getMarketConfig(code) {
    if (!code)
        return undefined;
    const normalized = code.toLowerCase();
    const resolvedCode = aliasMap.get(normalized) ?? normalized;
    return configMap.get(resolvedCode);
}
export function matchCommodity(config, value) {
    const normalized = normalize(value);
    return config.commodities.find((commodity) => {
        if (normalize(commodity.commodity) === normalized)
            return true;
        return commodity.synonyms?.some((syn) => normalize(syn) === normalized);
    });
}
export function matchVariety(commodity, value) {
    if (!value)
        return commodity.varieties[0];
    const normalized = normalize(value);
    return commodity.varieties.find((variety) => {
        if (normalize(variety.code) === normalized)
            return true;
        if (normalize(variety.name) === normalized)
            return true;
        return variety.synonyms?.some((syn) => normalize(syn) === normalized);
    });
}
export function normalize(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
