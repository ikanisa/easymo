import type { PaymentProviderAdapter, PaymentRequest, PaymentResponse,ProviderSecrets } from './types.ts';
import { encodeBase64 } from './utils.ts';

const MTN_BASE_URL = {
  sandbox: 'https://sandbox.momodeveloper.mtn.com',
  production: 'https://proxy.momoapi.mtn.com',
};

async function getMoMoToken(secrets: ProviderSecrets): Promise<string> {
  if (!secrets.apiKey || !secrets.apiSecret || !secrets.subscriptionKey) {
    throw new Error('Missing MTN MoMo credentials');
  }

  const baseUrl = MTN_BASE_URL[secrets.environment];
  const response = await fetch(`${baseUrl}/collection/token/`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${encodeBase64(`${secrets.apiKey}:${secrets.apiSecret}`)}`,
      'Ocp-Apim-Subscription-Key': secrets.subscriptionKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(`Failed to obtain MTN token: ${response.status}`);
  }

  const payload = await response.json();
  return payload.access_token as string;
}

async function initiateMoMoPayment(request: PaymentRequest, secrets: ProviderSecrets): Promise<PaymentResponse> {
  const token = await getMoMoToken(secrets);
  const baseUrl = MTN_BASE_URL[secrets.environment];

  const response = await fetch(`${baseUrl}/collection/v1_0/requesttopay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Reference-Id': request.referenceId,
      'X-Target-Environment': secrets.environment,
      'Ocp-Apim-Subscription-Key': secrets.subscriptionKey ?? '',
      'X-Callback-Url': secrets.callbackUrl ?? '',
      'X-Correlation-Id': request.correlationId,
    },
    body: JSON.stringify({
      amount: request.amount.toString(),
      currency: request.currency,
      externalId: request.referenceId,
      payer: {
        partyIdType: 'MSISDN',
        partyId: request.phoneNumber.replace(/\+/g, ''),
      },
      payerMessage: request.description ?? 'Farmer market order',
      payeeNote: `Order ${request.referenceId.slice(0, 8)}`,
    }),
  });

  if (response.status === 202) {
    return {
      success: true,
      transactionId: request.referenceId,
      providerMetadata: { targetEnvironment: secrets.environment },
    };
  }

  const errorBody = await response.text();
  return {
    success: false,
    error: `MTN MoMo error ${response.status}: ${errorBody}`,
  };
}

export const mtnAdapter: PaymentProviderAdapter = {
  id: 'mtn',
  label: 'MTN MoMo',
  supportsCodFallback: false,
  initiatePayment: initiateMoMoPayment,
};
