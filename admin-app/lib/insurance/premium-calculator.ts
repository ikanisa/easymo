import { InsuranceComparisonQuote } from "@/lib/schemas";

type PremiumInputs = {
  sumInsured: number;
  coverType: string;
  usage: string;
  vehicleAgeYears: number;
  seats: number;
  periodDays: number;
  comesa: boolean;
  comesaPassengers: number;
  theftExtension: boolean;
  governmentWaiver: boolean;
  occupantPlan?: number | null;
  occupantCount?: number;
  installmentMonths?: number;
};

type Installment = {
  label: string;
  amountMinor: number;
  dueInDays: number;
};

type PremiumComputation = {
  quotes: InsuranceComparisonQuote[];
  installments: Installment[];
};

const BASE_RATE_BY_COVER: Record<string, number> = {
  COMPREHENSIVE: 0.042,
  OD_THEFT_FIRE: 0.038,
  MD_ONLY: 0.03,
  THEFT_ONLY: 0.022,
  FIRE_ONLY: 0.02,
  TP_ONLY: 0.018,
};

const USAGE_LOADER: Record<string, number> = {
  PRIVATE: 0,
  TAXI_PSV: 0.015,
  HIRE: 0.012,
  SCHOOL_BUS: 0.01,
  COMMERCIAL_GOODS: 0.009,
  DRIVING_SCHOOL: 0.008,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function computeNetPremium(inputs: PremiumInputs): number {
  const baseRate = BASE_RATE_BY_COVER[inputs.coverType] ?? 0.025;
  const usageLoad = USAGE_LOADER[inputs.usage] ?? 0;
  const ageLoad = clamp(inputs.vehicleAgeYears * 0.0025, 0, 0.05);
  const seatLoad = clamp(Math.max(0, inputs.seats - 5) * 0.002, 0, 0.03);
  const periodFactor = clamp(inputs.periodDays / 365, 0.1, 1.2);

  let netPremium = inputs.sumInsured * (baseRate + usageLoad + ageLoad + seatLoad) * periodFactor;

  if (inputs.comesa) {
    netPremium += 12000 + inputs.comesaPassengers * 2500;
  }
  if (inputs.theftExtension) {
    netPremium += inputs.sumInsured * 0.004;
  }
  if (inputs.governmentWaiver) {
    netPremium += 15000;
  }
  if (inputs.occupantPlan && inputs.occupantCount) {
    netPremium += inputs.occupantPlan * inputs.occupantCount * 2500;
  }

  return Math.round(netPremium / 1000) * 1000;
}

function buildInstallments(total: number, months = 12): Installment[] {
  const tranches = Math.max(1, Math.round(months / 3));
  const trancheAmount = Math.round(total / tranches);

  return Array.from({ length: tranches }, (_, index) => {
    const dueInDays = (index + 1) * Math.round((months / tranches) * 30);
    const isLast = index === tranches - 1;
    return {
      label: isLast ? `Final installment (${months}m)` : `Installment ${index + 1}`,
      amountMinor: isLast ? total - trancheAmount * (tranches - 1) : trancheAmount,
      dueInDays,
    } satisfies Installment;
  });
}

function addInsurerVariation(
  base: InsuranceComparisonQuote,
  variation: {
    insurer: string;
    product: string;
    netMultiplier: number;
    feeMinor: number;
    taxRate: number;
    turnaroundHours: number;
    notes?: string[];
  },
): InsuranceComparisonQuote {
  const netPremiumMinor = Math.round(base.netPremiumMinor * variation.netMultiplier);
  const feesMinor = variation.feeMinor;
  const taxesMinor = Math.round((netPremiumMinor + feesMinor) * variation.taxRate);
  const grossPremiumMinor = netPremiumMinor + feesMinor + taxesMinor;

  return {
    insurer: variation.insurer,
    product: variation.product,
    netPremiumMinor,
    feesMinor,
    taxesMinor,
    grossPremiumMinor,
    turnaroundHours: variation.turnaroundHours,
    notes: variation.notes ?? [],
  } satisfies InsuranceComparisonQuote;
}

export function calculatePremiums(inputs: PremiumInputs): PremiumComputation {
  const baseNetPremium = computeNetPremium(inputs);
  const baseQuote: InsuranceComparisonQuote = {
    insurer: "BK Insurance",
    product: inputs.coverType === "TP_ONLY" ? "Third Party" : "Motor Comprehensive",
    netPremiumMinor: baseNetPremium,
    feesMinor: 15000,
    taxesMinor: Math.round((baseNetPremium + 15000) * 0.18),
    grossPremiumMinor: 0,
    turnaroundHours: 2,
    notes: ["Live-calculated base quote"],
  };
  baseQuote.grossPremiumMinor = baseQuote.netPremiumMinor + baseQuote.feesMinor + baseQuote.taxesMinor;

  const quotes: InsuranceComparisonQuote[] = [
    baseQuote,
    addInsurerVariation(baseQuote, {
      insurer: "Radiant",
      product: baseQuote.product,
      netMultiplier: 1.05,
      feeMinor: 12000,
      taxRate: 0.18,
      turnaroundHours: 4,
      notes: ["Requires valuation above 40M"],
    }),
    addInsurerVariation(baseQuote, {
      insurer: "Prime Life",
      product: baseQuote.product,
      netMultiplier: inputs.usage === "TAXI_PSV" ? 1.12 : 0.96,
      feeMinor: 10000,
      taxRate: 0.18,
      turnaroundHours: 6,
      notes: ["Includes emergency medical"],
    }),
  ];

  const installments = buildInstallments(
    quotes[0].grossPremiumMinor,
    inputs.installmentMonths ?? (inputs.comesa ? 12 : 9),
  );

  return { quotes, installments } satisfies PremiumComputation;
}

export function describeOcrConfidence(confidence?: number | null): {
  level: "high" | "medium" | "low";
  message: string;
} {
  if (confidence === undefined || confidence === null) {
    return {
      level: "medium",
      message: "Waiting for OCR results.",
    };
  }
  if (confidence >= 0.85) {
    return {
      level: "high",
      message: "OCR extraction looks reliable. Continue to coverage.",
    };
  }
  if (confidence >= 0.65) {
    return {
      level: "medium",
      message: "Some vehicle details need human confirmation before quoting.",
    };
  }
  return {
    level: "low",
    message: "Confidence is low – double check VIN, plate, and previous insurer.",
  };
}

export type { PremiumInputs as InsurancePremiumInputs, Installment as InsuranceInstallment };
