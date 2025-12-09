import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ussdConfig } from "@ibimina/config";

import { buildUssdPayload } from "../../src/ussd/builder";

describe("buildUssdPayload", () => {
  const baseDate = new Date("2025-01-01T00:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(baseDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("constructs a fully populated payload using the default operator", () => {
    const payload = buildUssdPayload({
      merchantCode: "12345",
      amount: 2500,
      reference: "INV-42",
      platform: "android",
    });

    const defaultOperator =
      ussdConfig.operators.find((operator) => operator.default) ?? ussdConfig.operators[0];

    expect(payload.operator.id).toBe(defaultOperator.id);
    expect(payload.code).toBe("*182*8*1*12345*2500#");
    expect(payload.telUri).toBe("tel:*182*8*1*12345*2500%23");
    expect(payload.canAutoDial).toBe(true);
    expect(payload.locale).toBe("en-RW");
    expect(payload.formattedAmount).toBe(
      new Intl.NumberFormat("en-RW", {
        style: "currency",
        currency: defaultOperator.currency,
        maximumFractionDigits: 0,
      }).format(2500)
    );
    expect(payload.copyText).toMatch(/Dial \*182\*8\*1\*12345\*2500# to pay/);
    expect(payload.instructions).toHaveLength(3);
    expect(payload.ttlSeconds).toBe(ussdConfig.ttlSeconds);
    expect(payload.expiresAt).toBe(
      new Date(baseDate.getTime() + ussdConfig.ttlSeconds * 1000).toISOString()
    );
  });

  it("honours locale and operator overrides while disabling auto dial when requested", () => {
    const airtel = ussdConfig.operators.find((operator) => operator.id === "airtel-rw");
    expect(airtel).toBeDefined();

    const payload = buildUssdPayload({
      merchantCode: "9988",
      operator: airtel!,
      locale: "fr-rw",
      allowAutoDial: false,
      platform: "android",
    });

    expect(payload.operator.id).toBe("airtel-rw");
    expect(payload.locale).toBe("fr-RW");
    expect(payload.code).toBe("*500*1*3*9988#");
    expect(payload.telUri).toBeUndefined();
    expect(payload.canAutoDial).toBe(false);
    expect(payload.copyText).toContain("Composez");
  });

  it("falls back to the first locale match when the preferred value is unknown", () => {
    const payload = buildUssdPayload({ merchantCode: "123", locale: "EN-rw" });

    expect(payload.locale).toBe("en-RW");
  });

  it("applies custom TTL and version overrides", () => {
    const payload = buildUssdPayload({
      merchantCode: "123",
      ttlSecondsOverride: 600,
      versionOverride: "preview",
    });

    expect(payload.ttlSeconds).toBe(600);
    expect(payload.version).toBe("preview");
    expect(payload.expiresAt).toBe(new Date(baseDate.getTime() + 600 * 1000).toISOString());
  });
});
