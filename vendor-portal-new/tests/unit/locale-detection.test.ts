import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { resolveRequestLocale } from "@/lib/i18n/resolve-locale";
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME } from "@/lib/i18n/locales";

type CookieRecord = { value: string };

type CookieMap = Map<string, CookieRecord>;

function createCookieStore(initial?: Record<string, string>) {
  const entries = Object.entries(initial ?? {}).map<[string, CookieRecord]>(([key, value]) => [
    key,
    { value },
  ]);
  const map: CookieMap = new Map(entries);
  return {
    get(name: string) {
      return map.get(name);
    },
  };
}

describe("resolveRequestLocale", () => {
  it("prefers the locale cookie when present", () => {
    const headers = new Headers({ "accept-language": "rw,en;q=0.8" });
    const locale = resolveRequestLocale({
      headers,
      cookies: createCookieStore({ [LOCALE_COOKIE_NAME]: "fr" }),
    });

    assert.equal(locale, "fr");
  });

  it("falls back to accept-language ordering", () => {
    const headers = new Headers({ "accept-language": "rw,en;q=0.8" });
    const locale = resolveRequestLocale({
      headers,
      cookies: createCookieStore(),
    });

    assert.equal(locale, "rw");
  });

  it("normalises region-specific language tags", () => {
    const headers = new Headers({ "accept-language": "fr-CA,fr;q=0.8,en;q=0.6" });
    const locale = resolveRequestLocale({
      headers,
      cookies: createCookieStore(),
    });

    assert.equal(locale, "fr");
  });

  it("returns the default locale when no hints are provided", () => {
    const headers = new Headers();
    const locale = resolveRequestLocale({
      headers,
      cookies: createCookieStore(),
    });

    assert.equal(locale, DEFAULT_LOCALE);
  });
});
