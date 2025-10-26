export type StationLoginPayload = {
  stationCode: string;
  passcode: string;
};

export type StationSession = {
  token: string;
  stationId: string;
  operatorName: string;
  stationName: string;
  expiresAt: string;
};

export type StationProfile = {
  stationId: string;
  stationName: string;
  operatorName: string;
};

export type StationBalance = {
  available: number;
  pending: number;
  currency: string;
  lastSyncedAt: string;
};

export type RedeemRequest = {
  voucherCode: string;
  method: "qr" | "code";
  context?: Record<string, string>;
};

export type RedeemSuccess = {
  status: "redeemed" | "already_redeemed";
  amount: number;
  currency: string;
  maskedMsisdn: string;
  redeemedAt: string;
  voucherId: string;
  reference: string;
};

export type RedeemError = {
  status: "not_found" | "invalid_station" | "network_error" | "replay" | "unknown_error";
  message: string;
  retryable: boolean;
};

export type RedeemResponse = RedeemSuccess | RedeemError;

export type RedemptionHistoryItem = {
  voucherId: string;
  amount: number;
  currency: string;
  maskedMsisdn: string;
  redeemedAt: string;
  status: "redeemed" | "already_redeemed" | "declined";
  reference: string;
};

export type StationHistoryResponse = {
  items: RedemptionHistoryItem[];
};
