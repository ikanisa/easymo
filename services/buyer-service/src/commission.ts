import { Prisma } from "@prisma/client";

export function computeCommissionAmount(
  grossAmount: Prisma.Decimal,
  options: {
    vendorAgentBps?: number | null;
    vendorEndorserBps?: number | null;
    scheduleRate?: Prisma.Decimal | null;
    flatFee?: Prisma.Decimal | null;
    attribution?: "AGENT" | "ENDORER" | "ENDORSER" | "AD" | "UNKNOWN";
  },
) {
  const ZERO = new Prisma.Decimal(0);
  const amount = grossAmount ?? ZERO;
  let rate = options.scheduleRate ?? ZERO;

  const attribution = options.attribution?.toUpperCase();
  const isEndorser = attribution === "ENDORSER" || attribution === "ENDORER";
  const isAgent = attribution === "AGENT";

  if (isEndorser && options.vendorEndorserBps != null) {
    rate = new Prisma.Decimal(options.vendorEndorserBps).div(10_000);
  } else if ((isEndorser || isAgent) && options.vendorAgentBps != null) {
    rate = new Prisma.Decimal(options.vendorAgentBps).div(10_000);
  } else if (!attribution && options.vendorAgentBps != null) {
    rate = new Prisma.Decimal(options.vendorAgentBps).div(10_000);
  }

  const flat = options.flatFee ?? ZERO;
  return amount.mul(rate).add(flat).toDecimalPlaces(4);
}
