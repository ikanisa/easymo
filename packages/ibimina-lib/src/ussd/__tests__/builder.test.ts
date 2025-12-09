import { describe, expect, it } from "vitest";
import { buildUssdPayload } from "../builder";

describe("buildUssdPayload", () => {
  it("builds android payload with tel uri", () => {
    const payload = buildUssdPayload({
      merchantCode: "123456",
      amount: 5000,
      reference: "REF123",
      locale: "en-RW",
      platform: "android",
    });

    expect(payload.code).toContain("123456");
    expect(payload.telUri).toMatch(/^tel:/);
    expect(payload.canAutoDial).toBe(true);
    expect(payload.instructions.length).toBeGreaterThan(0);
    expect(payload.formattedAmount).toMatch(/RWF|Frw|RF/);
    expect(payload.version).toBeTruthy();
    expect(payload.ttlSeconds).toBeGreaterThan(0);
  });

  it("disables autodial for ios", () => {
    const payload = buildUssdPayload({
      merchantCode: "123456",
      amount: 5000,
      reference: "REF123",
      locale: "en-RW",
      platform: "ios",
    });

    expect(payload.telUri).toBeUndefined();
    expect(payload.canAutoDial).toBe(false);
    expect(payload.copyText).toContain("REF123");
  });

  it("falls back to default locale when unknown", () => {
    const payload = buildUssdPayload({
      merchantCode: "123456",
      amount: 5000,
      reference: "REF123",
      locale: "es-ES",
      platform: "web",
    });

    expect(payload.locale).not.toEqual("es-ES");
    expect(payload.instructions.length).toBeGreaterThan(0);
  });
});
