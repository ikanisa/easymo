import { describe, expect, it } from "@jest/globals";
import { Prisma } from "@prisma/client";
import { computeCommissionAmount } from "../src/commission";

describe("computeCommissionAmount", () => {
  it("uses vendor endorser bps when attribution is ENDORSER", () => {
    const amt = computeCommissionAmount(new Prisma.Decimal(100), {
      vendorEndorserBps: 500,
      vendorAgentBps: 300,
      scheduleRate: new Prisma.Decimal(0.02),
      attribution: "ENDORSER",
    });
    expect(amt.toNumber()).toBeCloseTo(5.0, 4);
  });

  it("falls back to vendor agent bps for AGENT attribution", () => {
    const amt = computeCommissionAmount(new Prisma.Decimal(200), {
      vendorEndorserBps: 500,
      vendorAgentBps: 250,
      scheduleRate: new Prisma.Decimal(0.02),
      attribution: "AGENT",
    });
    expect(amt.toNumber()).toBeCloseTo(5.0, 4);
  });

  it("falls back to schedule rate when no vendor bps present", () => {
    const amt = computeCommissionAmount(new Prisma.Decimal(300), {
      scheduleRate: new Prisma.Decimal(0.03),
      flatFee: new Prisma.Decimal(1),
      attribution: "AD",
    });
    expect(amt.toNumber()).toBeCloseTo(10.0, 4); // 9 + 1 flat
  });

  it("treats legacy ENDORER attribution as ENDORSER", () => {
    const amt = computeCommissionAmount(new Prisma.Decimal(150), {
      vendorEndorserBps: 400,
      vendorAgentBps: 250,
      scheduleRate: new Prisma.Decimal(0.01),
      attribution: "ENDORER",
    });
    expect(amt.toNumber()).toBeCloseTo(6.0, 4);
  });

  it("falls back to agent bps when endorser bps missing", () => {
    const amt = computeCommissionAmount(new Prisma.Decimal(180), {
      vendorAgentBps: 350,
      scheduleRate: new Prisma.Decimal(0.01),
      attribution: "ENDORSER",
    });
    expect(amt.toNumber()).toBeCloseTo(6.3, 4);
  });

  it("uses agent bps when attribution missing but provided", () => {
    const amt = computeCommissionAmount(new Prisma.Decimal(80), {
      vendorAgentBps: 200,
    });
    expect(amt.toNumber()).toBeCloseTo(1.6, 4);
  });
});
