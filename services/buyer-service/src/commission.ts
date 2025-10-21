import { Prisma } from "@prisma/client";

// Commission model removed. Always returns zero.
export function computeCommissionAmount(
  _grossAmount: Prisma.Decimal,
  _options: {
    vendorAgentBps?: number | null;
    vendorEndorserBps?: number | null;
    scheduleRate?: Prisma.Decimal | null;
    flatFee?: Prisma.Decimal | null;
    attribution?: "AGENT" | "ENDORER" | "ENDORSER" | "AD" | "UNKNOWN";
  },
) {
  return new Prisma.Decimal(0);
}
