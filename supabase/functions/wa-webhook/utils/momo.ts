import { encodeTelUri, formatUssdText } from "./ussd.ts";

export function buildMomoUssd(
  target: string,
  isCode: boolean,
  amount?: number | null,
): { ussd: string; telUri: string } {
  const digits = target.replace(/\D/g, "");
  const amtSegment = amount && amount > 0 ? `*${amount}` : "";
  const human = isCode
    ? `*182*8*1*${digits}${amtSegment}#`
    : `*182*1*1*${digits}${amtSegment}#`;
  return { ussd: formatUssdText(human), telUri: encodeTelUri(human) };
}
