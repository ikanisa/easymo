import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isMissingRelationError } from "@/lib/supabase/errors";

const baseError = {
  code: "XX000",
  message: "generic error",
  details: null,
  hint: null,
};

describe("isMissingRelationError", () => {
  it("returns false for nullish values", () => {
    assert.equal(isMissingRelationError(null), false);
    assert.equal(isMissingRelationError(undefined), false);
  });

  it("matches postgres relation missing code", () => {
    assert.equal(isMissingRelationError({ ...baseError, code: "42P01" }), true);
  });

  it("matches textual relation missing hints", () => {
    assert.equal(
      isMissingRelationError({
        ...baseError,
        message: "relation app.audit_logs does not exist",
        details: "",
        hint: null,
      }),
      true
    );
    assert.equal(
      isMissingRelationError({
        ...baseError,
        message: "",
        details: "table app.foo does not exist",
        hint: null,
      }),
      true
    );
  });

  it("returns false for other errors", () => {
    assert.equal(
      isMissingRelationError({
        ...baseError,
        message: "violates foreign key constraint",
        code: "23503",
      }),
      false
    );
  });
});
