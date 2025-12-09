import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cn } from "../../src/utils/cn.js";

describe("cn utility", () => {
  it("joins valid class names with spaces", () => {
    const result = cn("foo", "bar", "baz");
    assert.equal(result, "foo bar baz");
  });

  it("filters out falsy values", () => {
    const result = cn("foo", false, null, "bar", undefined, "baz");
    assert.equal(result, "foo bar baz");
  });

  it("handles empty input", () => {
    const result = cn();
    assert.equal(result, "");
  });

  it("handles all falsy values", () => {
    const result = cn(false, null, undefined);
    assert.equal(result, "");
  });

  it("handles single class name", () => {
    const result = cn("single");
    assert.equal(result, "single");
  });

  it("handles conditional classes", () => {
    const isActive = true;
    const isDisabled = false;
    const result = cn("base", isActive && "active", isDisabled && "disabled");
    assert.equal(result, "base active");
  });
});
