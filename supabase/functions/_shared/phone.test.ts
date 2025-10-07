import {
  buildDigitFuzzyPattern,
  buildNumberLookupCandidates,
  detectCountryIso,
  digitsOnly,
  normalizeE164,
  toE164,
} from "./phone.ts";

Deno.test("normalizeE164 trims and enforces plus", () => {
  const value = normalizeE164("  +250 788 123 456 ");
  if (value !== "+250788123456") {
    throw new Error(`Expected +250788123456, got ${value}`);
  }
});

Deno.test("toE164 falls back to digits when normalize fails", () => {
  const value = toE164("250-788-123-456");
  if (value !== "+250788123456") {
    throw new Error(`Expected +250788123456, got ${value}`);
  }
});

Deno.test("buildNumberLookupCandidates produces useful variants", () => {
  const variants = buildNumberLookupCandidates("+250 788 123 456");
  const expected = new Set([
    "+250788123456",
    "250788123456",
    "0250788123456",
    "00250788123456",
  ]);
  for (const candidate of expected) {
    if (!variants.includes(candidate)) {
      throw new Error(`Missing candidate ${candidate}`);
    }
  }
});

Deno.test("digitsOnly strips non-numeric characters", () => {
  const result = digitsOnly(" +1 (234) 567-8900 ");
  if (result !== "12345678900") {
    throw new Error(`Unexpected digits ${result}`);
  }
});

Deno.test("buildDigitFuzzyPattern weaves wildcards", () => {
  const result = buildDigitFuzzyPattern("123");
  if (result !== "%1%2%3%") {
    throw new Error(`Unexpected pattern ${result}`);
  }
});

Deno.test("detectCountryIso resolves E.164 country code", () => {
  const iso = detectCountryIso("+250788123456");
  if (iso !== "RW") {
    throw new Error(`Expected RW, got ${String(iso)}`);
  }
});

Deno.test("detectCountryIso handles invalid numbers", () => {
  const iso = detectCountryIso("12345");
  if (iso !== null) {
    throw new Error(`Expected null, got ${String(iso)}`);
  }
});
