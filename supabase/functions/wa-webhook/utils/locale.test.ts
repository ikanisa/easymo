import { assertEquals } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import type { ContactChange } from "./locale.ts";
import {
  buildContactLocaleIndex,
  detectMessageLanguage,
  normalizeDisplayNumber,
  normalizeWaId,
} from "./locale.ts";

Deno.test("normalizeWaId cleans and prefixes numbers", () => {
  assertEquals(normalizeWaId("250700000000"), "+250700000000");
  assertEquals(normalizeWaId("+250700000000"), "+250700000000");
  assertEquals(normalizeWaId("  +250 700-000-000  "), "+250700000000");
  assertEquals(normalizeWaId("++250700000000"), "+250700000000");
  assertEquals(normalizeWaId(""), "");
});

Deno.test("normalizeDisplayNumber strips non digits", () => {
  assertEquals(normalizeDisplayNumber("  +250 700-000-000"), "+250700000000");
});

Deno.test("detectMessageLanguage prefers message language", () => {
  const locales = new Map<string, string>();
  const msg = { language: { code: "fr" }, from: "250700000000" };
  assertEquals(detectMessageLanguage(msg, locales), "fr");
});

Deno.test("detectMessageLanguage falls back to contacts", () => {
  const locales = buildContactLocaleIndex([
    {
      value: {
        contacts: [
          {
            wa_id: " +250 700-000-000 ",
            profile: { locale: "fr" },
          },
        ],
      },
    } as ContactChange,
  ]);
  const msg = { from: "250700000000" };
  assertEquals(detectMessageLanguage(msg, locales), "fr");
});
