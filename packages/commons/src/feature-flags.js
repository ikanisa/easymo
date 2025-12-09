const DEFAULT_FLAGS = {
    "agent.chat": true,
    "agent.webSearch": false,
    "agent.collectPayment": false,
    "agent.warmTransfer": false,
    "agent.negotiation": false,
    "agent.scheduling": false,
    "agent.marketplace": false,
    "wallet.service": false,
    "marketplace.ranking": false,
    "marketplace.vendor": false,
    "marketplace.buyer": false,
};
const envFlag = (flag) => {
    const key = `FEATURE_${flag.replace(/\./g, "_").toUpperCase()}`;
    const value = process.env[key];
    if (!value)
        return undefined;
    return ["1", "true", "yes"].includes(value.toLowerCase());
};
export const isFeatureEnabled = (flag) => {
    const override = envFlag(flag);
    if (override !== undefined)
        return override;
    return DEFAULT_FLAGS[flag];
};
