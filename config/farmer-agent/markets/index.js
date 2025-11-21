"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMarketConfigs = listMarketConfigs;
exports.getMarketConfig = getMarketConfig;
exports.matchCommodity = matchCommodity;
exports.matchVariety = matchVariety;
exports.normalize = normalize;
const sn_dakar_json_1 = __importDefault(require("./sn-dakar.json"));
const gh_accra_json_1 = __importDefault(require("./gh-accra.json"));
const ci_abidjan_json_1 = __importDefault(require("./ci-abidjan.json"));
const rawConfigs = [sn_dakar_json_1.default, gh_accra_json_1.default, ci_abidjan_json_1.default];
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
function listMarketConfigs() {
    return Array.from(configMap.values());
}
function getMarketConfig(code) {
    if (!code)
        return undefined;
    const normalized = code.toLowerCase();
    const resolvedCode = aliasMap.get(normalized) ?? normalized;
    return configMap.get(resolvedCode);
}
function matchCommodity(config, value) {
    const normalized = normalize(value);
    return config.commodities.find((commodity) => {
        if (normalize(commodity.commodity) === normalized)
            return true;
        return commodity.synonyms?.some((syn) => normalize(syn) === normalized);
    });
}
function matchVariety(commodity, value) {
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
function normalize(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
