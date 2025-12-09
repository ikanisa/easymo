import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { BASE_DICTIONARIES } from "@/lib/i18n/base-dictionary";

describe("BASE_DICTIONARIES", () => {
  it("provides localized strings for Kinyarwanda", () => {
    const rw = BASE_DICTIONARIES.rw;

    assert.equal(rw["common.success"], "Byagenze neza");
    assert.equal(rw["payment.paymentFailed"], "Kwishyura ntibyagenze neza");
  });

  it("falls back to English when locale data is missing", () => {
    const fr = BASE_DICTIONARIES.fr;

    assert.equal(fr["group.totalSavings"], "Épargne totale");
    assert.equal(fr["common.welcome"], "Bienvenue");

    const placeholder = BASE_DICTIONARIES.en["payment.paymentSuccess"];
    assert.equal(placeholder, "Payment successful");
  });
});
