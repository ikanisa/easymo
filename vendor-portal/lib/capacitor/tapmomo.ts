import { registerPlugin } from "@capacitor/core";

export interface TapMoMoPlugin {
  checkNfcAvailable(): Promise<{
    available: boolean;
    enabled: boolean;
    hceSupported: boolean;
  }>;

  armPayee(options: {
    network: "MTN" | "Airtel";
    merchantId: string;
    amount?: number;
    ref?: string;
    merchantKey: string;
    ttlSeconds?: number;
  }): Promise<{
    success: boolean;
    nonce: string;
    expiresAt: number;
  }>;

  disarmPayee(): Promise<void>;

  startReader(): Promise<{
    success: boolean;
    message: string;
  }>;

  stopReader(): Promise<void>;

  launchUssd(options: {
    network: "MTN" | "Airtel";
    merchantId: string;
    amount?: number;
    subscriptionId?: number;
  }): Promise<{
    success: boolean;
    ussdCode: string;
  }>;

  getActiveSubscriptions(): Promise<{
    subscriptions: Array<{
      subscriptionId: number;
      displayName: string;
      carrierName: string;
      number: string;
    }>;
  }>;

  addListener(
    eventName: "payloadReceived",
    listenerFunc: (data: {
      success: boolean;
      network: string;
      merchantId: string;
      amount?: number;
      currency: string;
      ref?: string;
      nonce: string;
    }) => void
  ): Promise<{ remove: () => Promise<void> }>;

  addListener(
    eventName: "readerError",
    listenerFunc: (data: { error: string }) => void
  ): Promise<{ remove: () => Promise<void> }>;
}

const TapMoMo = registerPlugin<TapMoMoPlugin>("TapMoMo");

export default TapMoMo;
