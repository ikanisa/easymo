import type { MobileMoneyProviderId, PaymentProviderAdapter } from './types.ts';
import { mtnAdapter } from './mtn.adapter.ts';
import { orangeAdapter } from './orange.adapter.ts';
import { waveAdapter } from './wave.adapter.ts';

const adapters: Record<MobileMoneyProviderId, PaymentProviderAdapter> = {
  mtn: mtnAdapter,
  orange: orangeAdapter,
  wave: waveAdapter,
};

export function getPaymentProviderAdapter(id: string): PaymentProviderAdapter | undefined {
  const normalized = id.toLowerCase() as MobileMoneyProviderId;
  return adapters[normalized];
}

export function listPaymentProviders(): PaymentProviderAdapter[] {
  return Object.values(adapters);
}

export * from './types.ts';
