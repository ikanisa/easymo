import { encodeTelUri, encodeTelUriForQr, formatUssdText } from "./ussd.ts";

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

/**
 * Builds MOMO USSD code with tel URI optimized for QR codes.
 * Uses unencoded * and # for better Android QR scanner compatibility.
 * 
 * @param target - Phone number or merchant code
 * @param isCode - True for merchant code, false for phone number
 * @param amount - Optional amount in RWF
 * @returns Object with human-readable USSD and QR-optimized tel URI
 */
export function buildMomoUssdForQr(
  target: string,
  isCode: boolean,
  amount?: number | null,
): { ussd: string; telUri: string } {
  const digits = target.replace(/\D/g, "");
  const amtSegment = amount && amount > 0 ? `*${amount}` : "";
  const human = isCode
    ? `*182*8*1*${digits}${amtSegment}#`
    : `*182*1*1*${digits}${amtSegment}#`;
  return { ussd: formatUssdText(human), telUri: encodeTelUriForQr(human) };
}
