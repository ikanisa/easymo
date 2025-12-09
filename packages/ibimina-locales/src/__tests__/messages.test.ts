import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { getMessageDictionary, resolveContentPack, resolveMessages } from "../index.js";

describe("@ibimina/locales fallbacks", () => {
  it("merges locale messages with the fallback locale", () => {
    const merged = resolveMessages("fr-SN");

    assert.equal(merged.common.welcome, "Bienvenue");
    assert.equal(merged.payment.paymentFailed, "Paiement échoué");
  });

  it("clones fallback messages when locale is missing", () => {
    const merged = resolveMessages("fr-CI");

    assert.equal(merged.common.welcome, "Welcome");
    assert.equal(merged.payment.paymentFailed, "Payment failed");
  });

  it("provides flattened dictionaries for runtime lookup", () => {
    const dictionary = getMessageDictionary("rw-RW");

    assert.equal(dictionary["common.success"], "Byagenze neza");
    assert.equal(dictionary["payment.confirmPayment"], "Emeza kwishyura");
  });

  it("resolves content packs with fallback data", () => {
    const pack = resolveContentPack("fr-CI");

    assert.equal(pack.countryISO3, "RWA");
    assert.ok(pack.ussd.providers[0].instructions.length > 0);
  });
});
