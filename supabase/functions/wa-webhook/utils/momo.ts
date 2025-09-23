export function buildMomoUssd(target: string, isCode: boolean, amount?: number | null): { ussd: string; telUri: string } {
  const digits = target.replace(/\D/g, "");
  const amtSegment = amount && amount > 0 ? `*${amount}` : "";
  const ussd = isCode ? `*182*8*1*${digits}${amtSegment}#` : `*182*1*1*${digits}${amtSegment}#`;
  return { ussd, telUri: encodeTelUri(ussd) };
}

function encodeTelUri(ussd: string): string {
  const encoded = ussd
    .replace(/#/g, "%23")
    .replace(/\*/g, "%2A");
  return `tel:${encoded}`;
}
