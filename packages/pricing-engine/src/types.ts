export type Currency = "RWF";

export type VehicleCategory =
  | "MOTORCYCLE"
  | "TRICYCLE"
  | "CAR"
  | "JEEP_SUV"
  | "PICKUP_SMALL_LORRY"
  | "MINIBUS_VAN"
  | "BUS"
  | "HOWO_SHACMAN_FUSO_FAW"
  | "TRUCK_LORRY_5T_PLUS"
  | "TRAILER"
  | "TRACTOR"
  | "SPECIAL_ENGINE";

export type UsageType =
  | "PRIVATE"
  | "TAXI_PSV"
  | "HIRE"
  | "SCHOOL_BUS"
  | "COMMERCIAL_GOODS"
  | "DRIVING_SCHOOL";

export type OwnerType = "INDIVIDUAL" | "CORPORATE";

export type CoverSelection =
  | "TP_ONLY"
  | "MD_ONLY"
  | "THEFT_ONLY"
  | "FIRE_ONLY"
  | "OD_THEFT_FIRE"
  | "COMPREHENSIVE";

export interface MandatoryExcess {
  md_percent_of_claim: number;
  theft_fire_percent_total_loss: number;
  minimum_rwf: number;
}

export interface BreakdownItem {
  label: string;
  amount: number;
  meta?: Record<string, unknown>;
}

export interface ShortTermBand {
  minDays: number;
  maxDays: number;
  factor: number;
}

export interface InstallmentTranche {
  atMonth: number;
  percent: number;
}

export interface InstallmentPlanOption {
  name: string;
  tranches: InstallmentTranche[];
}

export interface OtfRates {
  md: number;
  theft: number;
  fire: number;
  comprehensive: number;
}

export interface TariffProvider {
  name: string;

  seatLoading: {
    taxiPassengerPerSeat: number;
    hirePerSeatInclDriver: number;
    schoolBusPerPassenger: number;
    goodsPerSeatInclDriver: number;
  };

  fees: {
    localPerVehicle: number;
    comesaPerVehicle: number;
  };

  comesa: {
    rateOfNetPremiumExclTheft: number;
    medicalPerPerson: number;
    yellowCardFee: number;
    theftTerritorialExtensionPrivate: number;
    theftTerritorialExtensionGoods: number;
  };

  ageLoading: {
    gt5_lte10: number;
    gt10: number;
    otfProhibitedAfterYears: number;
  };

  excessWaiver: {
    allowedForGovernmentOnly: boolean;
    loadFactor_on_OTF: number;
    minPrivate: number;
    minCommercial: number;
  };

  shortTerm: ShortTermBand[];
  installments: InstallmentPlanOption[];

  tpBase: {
    privateUse: Partial<Record<VehicleCategory, number>>;
    taxiPsv: Partial<Record<VehicleCategory, number>>;
    hire: Partial<Record<VehicleCategory, number>>;
    goods: Partial<Record<VehicleCategory, number>>;
    flammableUpliftOnGoods?: number;
  };

  ownerTypeTpDiff?: {
    corporate: Partial<Record<VehicleCategory, number>>;
    individual: Partial<Record<VehicleCategory, number>>;
  };

  otf: {
    privateUse: Partial<Record<VehicleCategory, OtfRates>>;
    commercialPassenger: Partial<Record<VehicleCategory, OtfRates>>;
    commercialGoods: Partial<Record<VehicleCategory, OtfRates>>;
    specialEngine?: Partial<Record<VehicleCategory, OtfRates>>;
  };

  mandatoryExcess: {
    byVehicleType: Partial<Record<VehicleCategory | "PSV" | "MINIBUSES_BUSES_SCHOOL" | "TRUCKS_LORRIES_TRAILERS_TRACTORS", MandatoryExcess>>;
  };

  notes?: string[];
}

export interface OccupantCoverInput {
  enabled: boolean;
  plan: 1 | 2 | 3 | 4 | 5;
  occupants: number;
  vehicleIsMotorcycle: boolean;
  usageType: UsageType;
}

export interface PricingInput {
  providerName?: string;
  sumInsured: number;
  vehicleCategory: VehicleCategory;
  usageType: UsageType;
  seats: number;
  passengerSeatsAboveDriver: number;
  ownerType: OwnerType;
  vehicleAgeYears: number;
  coverSelection: CoverSelection;
  wantsComesa: boolean;
  comesaPassengers: number;
  theftTerritorialExtension: boolean;
  periodDays: number;
  occupantCover?: OccupantCoverInput;
  goodsAreFlammable: boolean;
  governmentExcessWaiver: boolean;
}

export interface PricingOutput {
  providerName: string;
  grossPremium: number;
  currency?: Currency;
  breakdown: BreakdownItem[];
  installmentOptions: InstallmentPlanOption[];
  mandatoryExcessApplicable: MandatoryExcess;
  warnings?: string[];
}

export interface MultiQuoteOutput {
  quotes: PricingOutput[];
  currency: Currency;
}

export interface InsurerProfile {
  providerName: string;
  slug: string;
  legalName: string;
  momoMerchantCode: string;
  momoReferencePrefix: string;
  momoChannelDescription: string;
  supportPhone: string;
  supportEmail: string;
  claimsEmail: string;
  headOfficeAddress: string;
  notes?: string[];
}
