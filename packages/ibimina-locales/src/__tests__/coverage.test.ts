import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { getMessages, getSurfaceCopy, resolveMessages, type SurfaceCopy } from "../index.js";

const LOCALES = ["en-RW", "rw-RW", "fr-RW"] as const;

describe("@ibimina/locales coverage", () => {
  it("exposes message trees for English, Kinyarwanda, and French", () => {
    for (const locale of LOCALES) {
      const messages = resolveMessages(locale);
      assert.equal(typeof messages.common.welcome, "string");
      assert.equal(typeof messages.payment.confirmPayment, "string");
    }
  });

  it("returns a concrete message object when using getMessages", () => {
    for (const locale of LOCALES) {
      const messages = getMessages(locale);
      assert.ok(messages, `messages missing for ${locale}`);
      assert.ok(messages?.common.welcome, `welcome missing for ${locale}`);
    }
  });

  it("provides surface copy short and long variants for all locales", () => {
    const selectors: Array<keyof SurfaceCopy["client"]["home"]> = [
      "metadata",
      "activity",
      "groups",
    ];

    for (const locale of LOCALES) {
      const clientCopy = getSurfaceCopy(locale, "client");

      for (const key of selectors) {
        const entry = clientCopy.home[key];
        if (!entry) {
          assert.fail(`missing client home copy for ${String(key)} in ${locale}`);
        }

        if ("title" in entry && "description" in entry) {
          assert.equal(typeof entry.title.short, "string");
          assert.equal(typeof entry.title.long, "string");
          assert.equal(typeof entry.description.short, "string");
          assert.equal(typeof entry.description.long, "string");
        }

        if ("fallbackLabel" in entry) {
          assert.equal(typeof entry.fallbackLabel.short, "string");
          assert.equal(typeof entry.fallbackLabel.long, "string");
        }

        if ("totalSaved" in entry) {
          assert.equal(typeof entry.totalSaved.short, "string");
          assert.equal(typeof entry.totalSaved.long, "string");
          assert.equal(typeof entry.pending.short, "string");
          assert.equal(typeof entry.pending.long, "string");
        }
      }
    }
  });
});
