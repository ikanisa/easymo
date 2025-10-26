export const maskMsisdn = (msisdn: string) => {
  if (!msisdn) {
    return "";
  }
  const normalized = msisdn.replace(/\s+/g, "");
  const digits = normalized.replace(/[^0-9+]/g, "");
  if (digits.length < 4) {
    return digits;
  }
  const country = digits.slice(0, 4);
  const prefix = digits.slice(4, 6);
  const suffix = digits.slice(-3);
  return `${country} ${prefix}* *** ${suffix}`;
};
