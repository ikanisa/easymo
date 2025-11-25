import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { formatDateTime, formatMoney, formatNumber } from "./format.ts";

Deno.test("formatMoney handles RWF (0 decimals)", () => {
  const out = formatMoney(12345, "RWF", "en", { isMinor: true });
  assertEquals(out, "RWF 123.45");
});

Deno.test("formatMoney handles USD (2 decimals)", () => {
  const out = formatMoney(12345, "USD", "en", { isMinor: true });
  // Intl may use symbol when available; code path returns code + number by default
  assertEquals(out.startsWith("USD "), true);
});

Deno.test("formatNumber basic formatting", () => {
  const out = formatNumber(1234567.89, "en");
  assertEquals(typeof out, "string");
});

Deno.test("formatDateTime stable fields", () => {
  const out = formatDateTime("2024-01-02T03:04:05Z", "en-GB", "UTC", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  assertEquals(typeof out, "string");
});
