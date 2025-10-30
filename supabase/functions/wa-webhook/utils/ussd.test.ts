import { assertEquals } from "../../../../tests/deps/asserts.ts";
import { encodeTelUri, encodeTelUriForQr, formatUssdText } from "./ussd.ts";

Deno.test("encodeTelUri formats tel URI", () => {
  const result = encodeTelUri("*182*8*1*123456#");
  assertEquals(result, "tel:%2A182%2A8%2A1%2A123456%23");
});

Deno.test("encodeTelUri keeps existing tel prefix", () => {
  const result = encodeTelUri("tel:*123#");
  assertEquals(result, "tel:%2A123%23");
});

Deno.test("encodeTelUriForQr creates unencoded tel URI for QR codes", () => {
  const result = encodeTelUriForQr("*182*8*1*123456#");
  assertEquals(result, "tel:*182*8*1*123456#");
});

Deno.test("encodeTelUriForQr handles merchant code with amount", () => {
  const result = encodeTelUriForQr("*182*8*1*123456*5000#");
  assertEquals(result, "tel:*182*8*1*123456*5000#");
});

Deno.test("encodeTelUriForQr handles msisdn with amount", () => {
  const result = encodeTelUriForQr("*182*1*1*0781234567*10000#");
  assertEquals(result, "tel:*182*1*1*0781234567*10000#");
});

Deno.test("encodeTelUriForQr preserves existing tel prefix", () => {
  const result = encodeTelUriForQr("tel:*123#");
  assertEquals(result, "tel:*123#");
});

Deno.test("formatUssdText normalizes whitespace", () => {
  const result = formatUssdText("  *182 * 8 *1 # ");
  assertEquals(result, "*182 * 8 *1 #");
});
