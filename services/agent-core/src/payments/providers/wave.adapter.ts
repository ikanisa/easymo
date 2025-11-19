import type { PaymentProviderAdapter, PaymentRequest, ProviderSecrets, PaymentResponse } from './types.ts';

const WAVE_BASE_URL = {
  sandbox: 'https://api.wave.com/sandbox',
  production: 'https://api.wave.com',
};

async function initiateWavePayment(request: PaymentRequest, secrets: ProviderSecrets): Promise<PaymentResponse> {
  if (!secrets.apiKey || !secrets.merchantId) {
    throw new Error('Missing Wave credentials');
  }

  const response = await fetch(`${WAVE_BASE_URL[secrets.environment]}/v1/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secrets.apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': request.referenceId,
    },
    body: JSON.stringify({
      merchantId: secrets.merchantId,
      amount: {
        currency: request.currency,
        value: request.amount,
      },
      metadata: {
        referenceId: request.referenceId,
        correlationId: request.correlationId,
        ...request.metadata,
      },
      customer: {
        phoneNumber: request.phoneNumber,
      },
      description: request.description ?? 'Farmer market order',
      successUrl: secrets.callbackUrl,
      cancelUrl: secrets.callbackUrl,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      success: false,
      error: payload.error ?? `Wave error ${response.status}`,
    };
  }

  return {
    success: true,
    transactionId: payload.id ?? request.referenceId,
    instructions: payload.checkoutUrl ?? 'Approve Wave prompt on your phone.',
    providerMetadata: payload,
  };
}

export const waveAdapter: PaymentProviderAdapter = {
  id: 'wave',
  label: 'Wave Mobile Money',
  supportsCodFallback: true,
  initiatePayment: initiateWavePayment,
};
