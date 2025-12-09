import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  SupportedLocale,
  normaliseLocaleTag,
  isSupportedLocale,
} from "./locales";

interface CookieStoreLike {
  get(name: string): { value: string } | undefined;
}

function resolveFromAcceptLanguage(header: string): SupportedLocale | null {
  return header
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [tag, ...params] = part.split(";");
      let quality = 1;
      for (const param of params) {
        const [key, value] = param.split("=");
        if (key?.trim() === "q" && value) {
          const parsed = Number.parseFloat(value);
          if (!Number.isNaN(parsed)) {
            quality = parsed;
          }
        }
      }
      return { tag, quality };
    })
    .sort((a, b) => b.quality - a.quality)
    .reduce<SupportedLocale | null>((match, candidate) => {
      if (match) return match;
      const normalised = normaliseLocaleTag(candidate.tag);
      return normalised ?? null;
    }, null);
}

export function resolveRequestLocale({
  headers,
  cookies,
}: {
  headers: Headers;
  cookies: CookieStoreLike;
}): SupportedLocale {
  const cookieLocale = cookies.get(LOCALE_COOKIE_NAME)?.value;
  if (isSupportedLocale(cookieLocale)) {
    return cookieLocale;
  }

  const acceptLanguage = headers.get("accept-language");
  if (acceptLanguage) {
    const normalised = resolveFromAcceptLanguage(acceptLanguage);
    if (normalised) {
      return normalised;
    }
  }

  return DEFAULT_LOCALE;
}
