const UINT32_MAX = 0xffffffff;

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

export type SamplingContext = {
  readonly event: string;
  readonly distinctId?: string | null;
  readonly sampleRate: number;
};

export const shouldSampleEvent = ({ event, distinctId, sampleRate }: SamplingContext): boolean => {
  if (!Number.isFinite(sampleRate) || sampleRate >= 1) {
    return true;
  }

  if (sampleRate <= 0) {
    return false;
  }

  const basis = `${distinctId ?? ""}:${event}`;
  const hash = hashString(basis);
  const normalized = hash / UINT32_MAX;
  return normalized < sampleRate;
};
