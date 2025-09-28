export const CAMELLIA_KEYWORD = "camellia";
export const CAMELLIA_MOMO_CODE = "0788815792";
export const CAMELLIA_MANAGER_E164 = "+250788767816";

export function isCamelliaMatch(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.toLowerCase().includes(CAMELLIA_KEYWORD);
}

export function isCamelliaBar(
  info: { slug?: string | null; name?: string | null },
): boolean {
  return isCamelliaMatch(info.slug) || isCamelliaMatch(info.name);
}
