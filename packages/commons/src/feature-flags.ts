export type FeatureFlag =
  | "agent.chat"
  | "agent.webSearch"
  | "agent.collectPayment"
  | "agent.warmTransfer"
  | "agent.negotiation"
  | "agent.scheduling"
  | "agent.marketplace"
  | "wallet.service"
  | "marketplace.ranking"
  | "marketplace.vendor"
  | "marketplace.buyer";

const DEFAULT_FLAGS: Record<FeatureFlag, boolean> = {
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

const envFlag = (flag: FeatureFlag) => {
  const key = `FEATURE_${flag.replace(/\./g, "_").toUpperCase()}`;
  const value = process.env[key];
  if (!value) return undefined;
  return ["1", "true", "yes"].includes(value.toLowerCase());
};

export const isFeatureEnabled = (flag: FeatureFlag) => {
  const override = envFlag(flag);
  if (override !== undefined) return override;
  return DEFAULT_FLAGS[flag];
};
