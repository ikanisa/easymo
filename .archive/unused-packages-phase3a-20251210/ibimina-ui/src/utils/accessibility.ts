export function calculateLuminance(hexColor: string): number {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const adjust = (value: number) => {
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * adjust(r) + 0.7152 * adjust(g) + 0.0722 * adjust(b);
}

export function contrastRatio(hexA: string, hexB: string): number {
  const lumA = calculateLuminance(hexA);
  const lumB = calculateLuminance(hexB);
  const brightest = Math.max(lumA, lumB);
  const darkest = Math.min(lumA, lumB);
  return (brightest + 0.05) / (darkest + 0.05);
}

export function meetsAaLargeText(hexA: string, hexB: string): boolean {
  return contrastRatio(hexA, hexB) >= 3.0;
}

export function meetsAaNormalText(hexA: string, hexB: string): boolean {
  return contrastRatio(hexA, hexB) >= 4.5;
}

export function meetsAaaNormalText(hexA: string, hexB: string): boolean {
  return contrastRatio(hexA, hexB) >= 7;
}

export function ensureTouchTarget(sizePx: number): boolean {
  return sizePx >= 48;
}
