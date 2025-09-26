import { assertEquals } from "../../../../tests/deps/asserts.ts";
import { encodeTelUri, formatUssdText } from "./ussd.ts";

Deno.test("encodeTelUri formats tel URI", () => {
  const result = encodeTelUri("*182*8*1*123456#");
  assertEquals(result, "tel:%2A182%2A8%2A1%2A123456%23");
});

Deno.test("encodeTelUri keeps existing tel prefix", () => {
  const result = encodeTelUri("tel:*123#");
  assertEquals(result, "tel:%2A123%23");
});

Deno.test("formatUssdText normalizes whitespace", () => {
  const result = formatUssdText("  *182 * 8 *1 # ");
  assertEquals(result, "*182 * 8 *1 #");
});
