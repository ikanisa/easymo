import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

Deno.test("Property Handler - Service Name", () => {
  assertEquals("wa-webhook-property", "wa-webhook-property");
});
