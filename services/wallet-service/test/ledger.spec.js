"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const ledger_1 = require("../src/ledger");
describe("buildTransferPlan", () => {
    it("creates balanced entries without commission", () => {
        const plan = (0, ledger_1.buildTransferPlan)({
            amount: new client_1.Prisma.Decimal(100),
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
        const plan = (0, ledger_1.buildTransferPlan)({
            amount: new client_1.Prisma.Decimal(100),
            sourceAccountId: "source",
            destinationAccountId: "dest",
            commission: {
                accountId: "commission",
                rate: new client_1.Prisma.Decimal(0.05),
                flatFee: new client_1.Prisma.Decimal(1),
            },
        });
        expect(plan.entries).toHaveLength(3);
        const commissionEntry = plan.entries.find((entry) => entry.accountId === "commission");
        expect(commissionEntry?.amount.toNumber()).toBeCloseTo(6);
        const destinationEntry = plan.entries.find((entry) => entry.accountId === "dest");
        expect(destinationEntry?.amount.toNumber()).toBeCloseTo(94);
    });
});
