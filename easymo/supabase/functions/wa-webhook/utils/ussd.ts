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

export function formatUssdText(humanUssd: string): string {
  return humanUssd.trim().replace(/\s+/g, " ");
}
