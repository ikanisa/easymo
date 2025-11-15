import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

Deno.test("Mobility Handler - Service Name", () => {
  assertEquals("wa-webhook-mobility", "wa-webhook-mobility");
});

Deno.test("Mobility Handler - Placeholder", () => {
  assertEquals(1 + 1, 2);
});
