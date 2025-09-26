import { assertEquals } from "../../../../../tests/deps/asserts.ts";

async function importWithNonce() {
  const nonce = crypto.randomUUID();
  return await import(`./browse.ts?nonce=${nonce}`);
}

Deno.test("buildMenuDeeplink uses bot number", async () => {
  Deno.env.set("WA_BOT_NUMBER_E164", "+250788000999");
  const { buildMenuDeeplink } = await importWithNonce();
  const url = buildMenuDeeplink("my-bar");
  assertEquals(url, "https://wa.me/250788000999?text=menu%20my-bar");
});

Deno.test("buildMenuDeeplink falls back without number", async () => {
  Deno.env.delete("WA_BOT_NUMBER_E164");
  const { buildMenuDeeplink } = await importWithNonce();
  const url = buildMenuDeeplink("other");
  assertEquals(url, "https://wa.me/?text=menu%20other");
});
