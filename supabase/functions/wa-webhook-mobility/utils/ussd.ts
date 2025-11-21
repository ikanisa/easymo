export function encodeTelUri(humanUssd: string): string {
  const trimmed = humanUssd.trim();
  if (!trimmed.startsWith("tel:")) {
    const normalized = trimmed.startsWith("*") ? trimmed : `*${trimmed}`;
    return `tel:${encode(normalized)}`;
  }
  return `tel:${encode(trimmed.slice(4))}`;
}

function encode(input: string): string {
  return input.replace(/\*/g, "%2A").replace(/#/g, "%23");
}

/**
 * Encodes a USSD string as a tel: URI for QR codes.
 * 
 * Android QR scanner apps often fail to decode percent-encoded characters
 * before passing the URI to the dialer. This function leaves * and # unencoded
 * for better Android compatibility while maintaining iOS support.
 * 
 * @param humanUssd - USSD string like "*182*8*1*123456#"
 * @returns Unencoded tel URI like "tel:*182*8*1*123456#"
 */
export function encodeTelUriForQr(humanUssd: string): string {
  const trimmed = humanUssd.trim();
  if (!trimmed.startsWith("tel:")) {
    const normalized = trimmed.startsWith("*") ? trimmed : `*${trimmed}`;
    return `tel:${normalized}`;
  }
  return trimmed;
}

export function formatUssdText(humanUssd: string): string {
  return humanUssd.trim().replace(/\s+/g, " ");
}
