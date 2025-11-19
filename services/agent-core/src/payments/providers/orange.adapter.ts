import type { PaymentProviderAdapter, PaymentRequest, ProviderSecrets, PaymentResponse } from './types.ts';
import { encodeBase64 } from './utils.ts';

const ORANGE_TOKEN_URL = 'https://api.orange.com/oauth/v3/token';
const ORANGE_BASE_URL = 'https://api.orange.com';

async function getOrangeToken(secrets: ProviderSecrets): Promise<string> {
  if (!secrets.apiKey || !secrets.apiSecret) {
    throw new Error('Missing Orange Money credentials');
  }

  const response = await fetch(ORANGE_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${encodeBase64(`${secrets.apiKey}:${secrets.apiSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`Failed to obtain Orange Money token: ${response.status}`);
  }

  const payload = await response.json();
  return payload.access_token as string;
}

async function initiateOrangePayment(request: PaymentRequest, secrets: ProviderSecrets): Promise<PaymentResponse> {
  const token = await getOrangeToken(secrets);
  const envPath = secrets.environment === 'production' ? 'prod' : 'dev';

  const response = await fetch(`${ORANGE_BASE_URL}/orange-money-webpay/${envPath}/v1/webpayment`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Correlation-Id': request.correlationId,
    },
    body: JSON.stringify({
      merchant_key: secrets.merchantId,
      currency: request.currency,
      order_id: request.referenceId,
      amount: request.amount,
      return_url: secrets.callbackUrl,
      cancel_url: secrets.callbackUrl,
      notif_url: secrets.callbackUrl,
      customer: {
        msisdn: request.phoneNumber,
      },
      pay_token: request.referenceId,
      description: request.description ?? 'Farmer market order',
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      success: false,
      error: payload.message ? `Orange Money error: ${payload.message}` : `Orange Money error ${response.status}`,
    };
  }

  return {
    success: true,
    transactionId: payload.payment_token ?? request.referenceId,
    instructions: payload.payment_url ?? 'Approve Orange Money push on your phone.',
    providerMetadata: payload,
  };
}

export const orangeAdapter: PaymentProviderAdapter = {
  id: 'orange',
  label: 'Orange Money',
  supportsCodFallback: true,
  initiatePayment: initiateOrangePayment,
};
