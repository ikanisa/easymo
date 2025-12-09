import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getBlurDataURL } from "../../src/utils/blur-placeholder.js";

describe("getBlurDataURL", () => {
  it("generates a data URL with default dimensions", () => {
    const result = getBlurDataURL();
    assert.ok(result.startsWith("data:image/svg+xml;base64,"));
  });

  it("generates a data URL with custom dimensions", () => {
    const result = getBlurDataURL({ width: 800, height: 600 });
    assert.ok(result.startsWith("data:image/svg+xml;base64,"));

    // Decode to verify dimensions are present
    const base64 = result.split(",")[1];
    const decoded = Buffer.from(base64, "base64").toString();
    assert.ok(decoded.includes('width="800"'));
    assert.ok(decoded.includes('height="600"'));
  });

  it("generates a data URL with custom accent color", () => {
    const result = getBlurDataURL({ accent: "#ff0000" });
    assert.ok(result.startsWith("data:image/svg+xml;base64,"));

    // Decode to verify accent color is present
    const base64 = result.split(",")[1];
    const decoded = Buffer.from(base64, "base64").toString();
    assert.ok(decoded.includes("#ff0000"));
  });

  it("enforces minimum width and height of 16px", () => {
    const result = getBlurDataURL({ width: 5, height: 8 });
    const base64 = result.split(",")[1];
    const decoded = Buffer.from(base64, "base64").toString();
    assert.ok(decoded.includes('width="16"'));
    assert.ok(decoded.includes('height="16"'));
  });

  it("rounds fractional dimensions", () => {
    const result = getBlurDataURL({ width: 123.7, height: 456.2 });
    const base64 = result.split(",")[1];
    const decoded = Buffer.from(base64, "base64").toString();
    assert.ok(decoded.includes('width="124"'));
    assert.ok(decoded.includes('height="456"'));
  });

  it("caches results for the same parameters", () => {
    const result1 = getBlurDataURL({ width: 300, height: 200, accent: "#123456" });
    const result2 = getBlurDataURL({ width: 300, height: 200, accent: "#123456" });

    // Should return the exact same string (cached)
    assert.equal(result1, result2);
  });

  it("returns different results for different parameters", () => {
    const result1 = getBlurDataURL({ width: 300, height: 200 });
    const result2 = getBlurDataURL({ width: 400, height: 200 });

    assert.notEqual(result1, result2);
  });

  it("generates valid SVG markup", () => {
    const result = getBlurDataURL({ width: 256, height: 128 });
    const base64 = result.split(",")[1];
    const decoded = Buffer.from(base64, "base64").toString();

    // Verify it contains essential SVG elements
    assert.ok(decoded.includes("<svg"));
    assert.ok(decoded.includes("xmlns="));
    assert.ok(decoded.includes("<defs>"));
    assert.ok(decoded.includes("<linearGradient"));
    assert.ok(decoded.includes("<rect"));
    assert.ok(decoded.includes("<animate"));
  });
});
