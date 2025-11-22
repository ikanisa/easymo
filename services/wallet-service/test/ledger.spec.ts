import { Prisma } from "@prisma/client";

import { buildTransferPlan } from "../src/ledger";

describe("buildTransferPlan", () => {
  it("creates balanced entries without commission", () => {
    const plan = buildTransferPlan({
      amount: new Prisma.Decimal(100),
      sourceAccountId: "source",
      destinationAccountId: "dest",
    });
    expect(plan.entries).toHaveLength(2);
    const debit = plan.entries.find((entry) => entry.direction === "debit");
    const credit = plan.entries.find((entry) => entry.direction === "credit");
    expect(debit?.amount.toNumber()).toBeCloseTo(100);
    expect(credit?.amount.toNumber()).toBeCloseTo(100);
  });

  it("applies commission rate and flat fee", () => {
    const plan = buildTransferPlan({
      amount: new Prisma.Decimal(100),
      sourceAccountId: "source",
      destinationAccountId: "dest",
      commission: {
        accountId: "commission",
        rate: new Prisma.Decimal(0.05),
        flatFee: new Prisma.Decimal(1),
      },
    });
    expect(plan.entries).toHaveLength(3);
    const commissionEntry = plan.entries.find((entry) => entry.accountId === "commission");
    expect(commissionEntry?.amount.toNumber()).toBeCloseTo(6);
    const destinationEntry = plan.entries.find((entry) => entry.accountId === "dest");
    expect(destinationEntry?.amount.toNumber()).toBeCloseTo(94);
  });
});
