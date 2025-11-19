export type MobileMoneyProviderId = 'mtn' | 'orange' | 'wave';

export interface PaymentRequest {
  amount: number;
  currency: string;
  phoneNumber: string;
  referenceId: string;
  correlationId: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderSecrets {
  apiKey: string;
  apiSecret?: string;
  subscriptionKey?: string;
  merchantId?: string;
  callbackUrl?: string;
  environment: 'sandbox' | 'production';
}

export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  instructions?: string;
  error?: string;
  providerMetadata?: Record<string, unknown>;
}

export interface PaymentProviderAdapter {
  id: MobileMoneyProviderId;
  label: string;
  supportsCodFallback: boolean;
  initiatePayment(request: PaymentRequest, secrets: ProviderSecrets): Promise<PaymentResponse>;
}
