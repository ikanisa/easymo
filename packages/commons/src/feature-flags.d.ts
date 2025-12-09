export type FeatureFlag = "agent.chat" | "agent.webSearch" | "agent.collectPayment" | "agent.warmTransfer" | "agent.negotiation" | "agent.scheduling" | "agent.marketplace" | "wallet.service" | "marketplace.ranking" | "marketplace.vendor" | "marketplace.buyer";
export declare const isFeatureEnabled: (flag: FeatureFlag) => boolean;
//# sourceMappingURL=feature-flags.d.ts.map