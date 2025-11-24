import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import EN from "./messages/en.json" with { type: "json" };
import FR from "./messages/fr.json" with { type: "json" };

Deno.test("i18n catalogs contain required common keys", () => {
  const required = [
    "common.home_button",
    "common.buttons.open",
    "common.buttons.select",
    "common.options",
  ];
  for (const key of required) {
    assert(key in EN, `missing EN key: ${key}`);
    assert(key in FR, `missing FR key: ${key}`);
  }
});
