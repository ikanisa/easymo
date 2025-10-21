export const CallDirection = {
  inbound: "inbound",
  outbound: "outbound",
} as const;

export type CallDirection = (typeof CallDirection)[keyof typeof CallDirection];

export const CallPlatform = {
  pstn: "pstn",
  whatsapp: "whatsapp",
  sip: "sip",
} as const;

export type CallPlatform = (typeof CallPlatform)[keyof typeof CallPlatform];
