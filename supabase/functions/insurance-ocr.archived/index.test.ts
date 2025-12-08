import { assertEquals } from "../../../tests/deps/asserts.ts";
import { determineNextStatus } from "./utils.ts";

Deno.test("determineNextStatus returns retry when attempts below max", () => {
  assertEquals(determineNextStatus(1, 3), "retry");
  assertEquals(determineNextStatus(2, 5), "retry");
});

Deno.test("determineNextStatus returns failed when attempts meet or exceed max", () => {
  assertEquals(determineNextStatus(3, 3), "failed");
  assertEquals(determineNextStatus(10, 2), "failed");
});
