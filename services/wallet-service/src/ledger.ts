import { Prisma } from "@prisma/client";

export type TransferInput = {
  amount: Prisma.Decimal;
  sourceAccountId: string;
  destinationAccountId: string;
  commission?: {
    accountId: string;
    rate?: Prisma.Decimal;
    flatFee?: Prisma.Decimal;
  };
};

export type LedgerEntry = {
  accountId: string;
  amount: Prisma.Decimal;
  direction: "debit" | "credit";
};

export type TransactionPlan = {
  entries: LedgerEntry[];
  commissionAmount: Prisma.Decimal;
};

const ZERO = new Prisma.Decimal(0);

const toDecimal = (value: Prisma.Decimal | number | string | undefined) => {
  if (value === undefined) return ZERO;
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(value);
};

export function calculateCommission(amount: Prisma.Decimal, commission?: TransferInput["commission"]): Prisma.Decimal {
  if (!commission) return ZERO;
  const ratePart = commission.rate ? amount.mul(commission.rate) : ZERO;
  const feePart = toDecimal(commission.flatFee ?? 0);
  return ratePart.add(feePart).toDecimalPlaces(4);
}

export function buildTransferPlan(input: TransferInput): TransactionPlan {
  if (input.amount.lte(ZERO)) {
    throw new Error("Amount must be greater than zero");
  }
  if (input.sourceAccountId === input.destinationAccountId) {
    throw new Error("Source and destination accounts must differ");
  }
  const commissionAmount = calculateCommission(input.amount, input.commission);
  if (commissionAmount.gt(input.amount)) {
    throw new Error("Commission exceeds amount");
  }

  const destinationNet = input.amount.sub(commissionAmount).toDecimalPlaces(4);

  const entries: LedgerEntry[] = [
    {
      accountId: input.sourceAccountId,
      amount: input.amount.toDecimalPlaces(4),
      direction: "debit",
    },
    {
      accountId: input.destinationAccountId,
      amount: destinationNet,
      direction: "credit",
    },
  ];

  if (commissionAmount.gt(ZERO)) {
    if (!input.commission?.accountId) {
      throw new Error("Commission account id missing");
    }
    entries.push({
      accountId: input.commission.accountId,
      amount: commissionAmount,
      direction: "credit",
    });
  }

  validateEntries(entries);
  return { entries, commissionAmount };
}

export function validateEntries(entries: LedgerEntry[]) {
  const totalDebit = entries
    .filter((entry) => entry.direction === "debit")
    .reduce((sum, entry) => sum.add(entry.amount), ZERO);
  const totalCredit = entries
    .filter((entry) => entry.direction === "credit")
    .reduce((sum, entry) => sum.add(entry.amount), ZERO);

  if (!totalDebit.sub(totalCredit).abs().lte(new Prisma.Decimal(0.0001))) {
    throw new Error("Ledger entries do not balance");
  }
}
