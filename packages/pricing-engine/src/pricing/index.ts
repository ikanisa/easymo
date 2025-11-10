import {
  BreakdownItem,
  CoverSelection,
  InstallmentPlanOption,
  MandatoryExcess,
  MultiQuoteOutput,
  OccupantCoverInput,
  PricingInput,
  PricingOutput,
  TariffProvider,
  UsageType,
  VehicleCategory,
} from "../types";
import { roundRwf, shortTermFactor } from "../utils";
import { BK_PROVIDER } from "./providers/BK";
import { OLD_MUTUAL_PROVIDER } from "./providers/OM";
import { PRIME_PROVIDER } from "./providers/Prime";
import { RADIANT_PROVIDER } from "./providers/Radiant";

export const PROVIDERS: Record<string, TariffProvider> = {
  [BK_PROVIDER.name]: BK_PROVIDER,
  [OLD_MUTUAL_PROVIDER.name]: OLD_MUTUAL_PROVIDER,
  [PRIME_PROVIDER.name]: PRIME_PROVIDER,
  [RADIANT_PROVIDER.name]: RADIANT_PROVIDER,
};

function pickMandatoryExcess(provider: TariffProvider, vehicle: VehicleCategory, usage: UsageType): MandatoryExcess {
  const table = provider.mandatoryExcess.byVehicleType;
  if (table[vehicle]) return table[vehicle]!;
  if (usage === "TAXI_PSV") return table.PSV ?? table.MINIBUS_VAN ?? table.CAR!;
  if (usage === "SCHOOL_BUS" || usage === "PRIVATE") {
    return table.MINIBUSES_BUSES_SCHOOL ?? table.BUS ?? table.MINIBUS_VAN ?? table.CAR!;
  }
  if (usage === "COMMERCIAL_GOODS") {
    return (
      table.TRUCKS_LORRIES_TRAILERS_TRACTORS ??
      table.TRUCK_LORRY_5T_PLUS ??
      table.PICKUP_SMALL_LORRY ??
      table.CAR!
    );
  }
  return table.CAR ?? table.MINIBUS_VAN ?? Object.values(table)[0]!;
}

function seatLoadingAmount(provider: TariffProvider, input: PricingInput): number {
  const { usageType, seats, passengerSeatsAboveDriver, vehicleCategory } = input;
  const seatRules = provider.seatLoading;
  let total = 0;
  if (usageType === "TAXI_PSV" && (vehicleCategory === "MINIBUS_VAN" || vehicleCategory === "BUS")) {
    total += seatRules.taxiPassengerPerSeat * passengerSeatsAboveDriver;
  }
  if (usageType === "HIRE") total += seatRules.hirePerSeatInclDriver * seats;
  if (usageType === "SCHOOL_BUS") total += seatRules.schoolBusPerPassenger * passengerSeatsAboveDriver;
  if (usageType === "COMMERCIAL_GOODS") total += seatRules.goodsPerSeatInclDriver * seats;
  return total;
}

function tpBasePremium(provider: TariffProvider, input: PricingInput): number {
  const { vehicleCategory, usageType, goodsAreFlammable, ownerType } = input;
  const tp = provider.tpBase;
  let base = 0;
  if (usageType === "PRIVATE") base = tp.privateUse[vehicleCategory] ?? 0;
  else if (usageType === "TAXI_PSV") base = tp.taxiPsv[vehicleCategory] ?? 0;
  else if (usageType === "HIRE") base = tp.hire[vehicleCategory] ?? 0;
  else if (usageType === "SCHOOL_BUS") base = tp.taxiPsv.BUS ?? tp.hire.BUS ?? 0;
  else if (usageType === "COMMERCIAL_GOODS" || usageType === "DRIVING_SCHOOL") base = tp.goods[vehicleCategory] ?? 0;

  if (!base && provider.ownerTypeTpDiff) {
    const map = ownerType === "INDIVIDUAL" ? provider.ownerTypeTpDiff.individual : provider.ownerTypeTpDiff.corporate;
    base = map?.[vehicleCategory] ?? 0;
  }

  if (usageType === "COMMERCIAL_GOODS" && input.goodsAreFlammable && provider.tpBase.flammableUpliftOnGoods) {
    base *= 1 + provider.tpBase.flammableUpliftOnGoods;
  }
  return base;
}

function otfRate(provider: TariffProvider, input: PricingInput) {
  const { usageType, vehicleCategory, goodsAreFlammable } = input;
  if (usageType === "PRIVATE") return provider.otf.privateUse[vehicleCategory];
  if (usageType === "TAXI_PSV" || usageType === "HIRE" || usageType === "SCHOOL_BUS") {
    return provider.otf.commercialPassenger[vehicleCategory];
  }
  if (usageType === "DRIVING_SCHOOL" || usageType === "COMMERCIAL_GOODS") {
    if (goodsAreFlammable) return { md: 0.0295, theft: 0.0084, fire: 0.0028, comprehensive: 0.0407 };
    return provider.otf.commercialGoods[vehicleCategory];
  }
  return provider.otf.privateUse[vehicleCategory];
}

function computeOtfPremium(provider: TariffProvider, input: PricingInput): number {
  const rate = otfRate(provider, input);
  if (!rate) return 0;
  switch (input.coverSelection) {
    case "MD_ONLY":
      return rate.md * input.sumInsured;
    case "FIRE_ONLY":
      return rate.fire * input.sumInsured;
    case "THEFT_ONLY":
      return rate.theft * input.sumInsured;
    case "OD_THEFT_FIRE":
    case "COMPREHENSIVE":
      return rate.comprehensive * input.sumInsured;
    default:
      return 0;
  }
}

function ageLoadingOnBase(provider: TariffProvider, input: PricingInput, baseForAgeLoad: number): number {
  const v = input.vehicleAgeYears;
  const a = provider.ageLoading;
  if (v > a.otfProhibitedAfterYears && input.coverSelection !== "TP_ONLY") return 0;
  if (v > 10) return baseForAgeLoad * a.gt10;
  if (v > 5) return baseForAgeLoad * a.gt5_lte10;
  return 0;
}

function computeComesaAddon(provider: TariffProvider, input: PricingInput, netPremiumExclTheft: number) {
  if (!input.wantsComesa) return { amount: 0, breakdown: [] as BreakdownItem[] };
  const c = provider.comesa;
  const comesaPrem = netPremiumExclTheft * c.rateOfNetPremiumExclTheft;
  const medical = c.medicalPerPerson * input.comesaPassengers;
  const yellow = c.yellowCardFee;
  const breakdown: BreakdownItem[] = [];
  if (comesaPrem) {
    breakdown.push({ label: "COMESA extension (30% of net premium excl. theft)", amount: roundRwf(comesaPrem) });
  }
  if (medical) {
    breakdown.push({ label: "COMESA medical fees", amount: roundRwf(medical), meta: { pax: input.comesaPassengers } });
  }
  breakdown.push({ label: "COMESA Yellow Card fee", amount: roundRwf(yellow) });
  return { amount: roundRwf(comesaPrem + medical + yellow), breakdown };
}

function theftTerritorialAddon(provider: TariffProvider, input: PricingInput): number {
  if (!input.theftTerritorialExtension) return 0;
  const rate = input.usageType === "COMMERCIAL_GOODS" || input.usageType === "DRIVING_SCHOOL"
    ? provider.comesa.theftTerritorialExtensionGoods
    : provider.comesa.theftTerritorialExtensionPrivate;
  return roundRwf(rate * input.sumInsured);
}

function occupantPremium(input: OccupantCoverInput | undefined): number {
  if (!input || !input.enabled) return 0;
  const rate = input.vehicleIsMotorcycle
    ? 0.008
    : input.usageType === "COMMERCIAL_GOODS" || input.usageType === "TAXI_PSV" || input.usageType === "HIRE" || input.usageType === "SCHOOL_BUS"
      ? 0.01
      : 0.005;
  const deathLimitPerPerson = input.plan * 1_000_000;
  return roundRwf(rate * deathLimitPerPerson * input.occupants);
}

function fees(provider: TariffProvider, input: PricingInput, selectedGuaranteesCount: number): number {
  const f = provider.fees;
  let amount = selectedGuaranteesCount * f.localPerVehicle;
  if (input.wantsComesa) amount += f.comesaPerVehicle;
  return amount;
}

function theftComponent(rate: ReturnType<typeof otfRate>, input: PricingInput): number {
  if (!rate || input.coverSelection === "TP_ONLY") return 0;
  if (input.coverSelection === "THEFT_ONLY") return rate.theft * input.sumInsured;
  if (input.coverSelection === "COMPREHENSIVE" || input.coverSelection === "OD_THEFT_FIRE") {
    return rate.theft * input.sumInsured;
  }
  return 0;
}

export function priceOne(provider: TariffProvider, input: PricingInput): PricingOutput {
  const warnings: string[] = [];
  const breakdown: BreakdownItem[] = [];

  const tp = tpBasePremium(provider, input);
  breakdown.push({ label: "Third Party base", amount: roundRwf(tp) });

  const seatLoad = seatLoadingAmount(provider, input);
  if (seatLoad) breakdown.push({ label: "Seat/Passenger loading", amount: roundRwf(seatLoad) });

  let otfPrem = 0;
  if (input.coverSelection !== "TP_ONLY" && input.vehicleAgeYears > provider.ageLoading.otfProhibitedAfterYears) {
    warnings.push(`Own Damage/Theft/Fire not permitted for vehicles older than ${provider.ageLoading.otfProhibitedAfterYears} years.`);
  } else {
    otfPrem = computeOtfPremium(provider, input);
  }
  if (otfPrem) breakdown.push({ label: "Own Damage/Theft/Fire", amount: roundRwf(otfPrem) });

  const baseForAgeLoad = tp + otfPrem;
  const ageLoad = ageLoadingOnBase(provider, input, baseForAgeLoad);
  if (ageLoad) breakdown.push({ label: "Age loading", amount: roundRwf(ageLoad) });

  const annualSubtotal = breakdown.reduce((sum, item) => sum + item.amount, 0);
  const factor = shortTermFactor(input.periodDays, provider.shortTerm);
  const periodPremium = roundRwf(annualSubtotal * factor);
  if (factor !== 1) {
    breakdown.push({ label: `Short-term factor x${factor}`, amount: periodPremium - annualSubtotal });
  }

  const rate = otfRate(provider, input);
  const theftPartAnnual = theftComponent(rate, input);
  const netExclTheftAnnual = annualSubtotal - theftPartAnnual;
  const netExclTheftForPeriod = netExclTheftAnnual * factor;

  const comesa = computeComesaAddon(provider, input, netExclTheftForPeriod);
  comesa.breakdown.forEach((item) => breakdown.push(item));

  const theftTerritorial = theftTerritorialAddon(provider, input);
  if (theftTerritorial) breakdown.push({ label: "Territorial extension of theft cover", amount: theftTerritorial });

  const occupant = occupantPremium(input.occupantCover);
  if (occupant) breakdown.push({ label: "Occupant Personal Accident", amount: occupant });

  if (input.governmentExcessWaiver && provider.excessWaiver.allowedForGovernmentOnly) {
    const baseOtfAfterFactor = roundRwf(otfPrem * factor);
    const load = Math.max(
      roundRwf(baseOtfAfterFactor * provider.excessWaiver.loadFactor_on_OTF),
      input.usageType === "PRIVATE" ? provider.excessWaiver.minPrivate : provider.excessWaiver.minCommercial,
    );
    breakdown.push({ label: "Excess waiver loading (Gov)", amount: load });
  }

  const guaranteesCount = 1 + (otfPrem ? 1 : 0) + (occupant ? 1 : 0) + (input.wantsComesa ? 1 : 0);
  const feesAmount = fees(provider, input, guaranteesCount);
  breakdown.push({ label: "Transaction fees", amount: feesAmount });

  const gross = breakdown.reduce((sum, b) => sum + b.amount, 0);
  const mandatoryExcess = pickMandatoryExcess(provider, input.vehicleCategory, input.usageType);

  return {
    providerName: provider.name,
    grossPremium: roundRwf(gross),
    currency: "RWF",
    breakdown,
    mandatoryExcessApplicable: mandatoryExcess,
    warnings,
    installmentOptions: provider.installments,
  };
}

export function multiPrice(inputs: Omit<PricingInput, "providerName">, providerNames?: string[]): MultiQuoteOutput {
  const providers = providerNames && providerNames.length
    ? providerNames.map((name) => PROVIDERS[name]).filter((p): p is TariffProvider => Boolean(p))
    : Object.values(PROVIDERS);
  const quotes: PricingOutput[] = providers.map((provider) => priceOne(provider, { ...inputs, providerName: provider.name }));
  return { quotes, currency: "RWF" };
}

export * from "../types";
