import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createRouterHandler } from "../../../apps/router-fn/src/router.ts";

Deno.test("router factory returns handler", () => {
  const handler = createRouterHandler();
  assertEquals(typeof handler, "function");
});
