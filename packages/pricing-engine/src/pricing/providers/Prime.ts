import { InstallmentPlanOption, OtfRates, ShortTermBand, TariffProvider } from "../../types";
import { defaultShortTermBands } from "../../utils";
import { BK_PROVIDER } from "./BK";

const otf = (md: number, theft: number, fire: number): OtfRates => ({
  md,
  theft,
  fire,
  comprehensive: md + theft + fire,
});

const shortTerm: ShortTermBand[] = defaultShortTermBands();

const installments: InstallmentPlanOption[] = [
  { name: "Option 1 (1m/2m/9m)", tranches: [{ atMonth: 1, percent: 25 }, { atMonth: 2, percent: 25 }, { atMonth: 9, percent: 50 }] },
  { name: "Option 2 (3m/9m)", tranches: [{ atMonth: 3, percent: 50 }, { atMonth: 9, percent: 50 }] },
  { name: "Option 3 (6m/12m)", tranches: [{ atMonth: 6, percent: 75 }, { atMonth: 12, percent: 25 }] },
  { name: "Option 4 (1m/3m/8m)", tranches: [{ atMonth: 1, percent: 25 }, { atMonth: 3, percent: 35 }, { atMonth: 8, percent: 40 }] },
];

export const PRIME_PROVIDER: TariffProvider = {
  name: "Prime Insurance",
  seatLoading: {
    taxiPassengerPerSeat: 14_000,
    hirePerSeatInclDriver: 14_000,
    schoolBusPerPassenger: 5_000,
    goodsPerSeatInclDriver: 7_500,
  },
  fees: {
    localPerVehicle: 2_500,
    comesaPerVehicle: 10_000,
  },
  comesa: {
    rateOfNetPremiumExclTheft: 0.3,
    medicalPerPerson: 3_000,
    yellowCardFee: 10_000,
    theftTerritorialExtensionPrivate: 0.006,
    theftTerritorialExtensionGoods: 0.01,
  },
  ageLoading: {
    gt5_lte10: 0.25,
    gt10: 0.5,
    otfProhibitedAfterYears: 15,
  },
  excessWaiver: {
    allowedForGovernmentOnly: true,
    loadFactor_on_OTF: 0.1,
    minPrivate: 90_000,
    minCommercial: 130_000,
  },
  shortTerm,
  installments,
  tpBase: {
    privateUse: {
      MOTORCYCLE: 39_000,
      CAR: 57_600,
      JEEP_SUV: 76_200,
      PICKUP_SMALL_LORRY: 86_100,
      MINIBUS_VAN: 129_600,
      BUS: 207_000,
    },
    taxiPsv: {
      MOTORCYCLE: 103_606,
      TRICYCLE: 103_606,
      CAR: 131_400,
      JEEP_SUV: 131_400,
      MINIBUS_VAN: 153_600,
      BUS: 153_600,
    },
    hire: {
      CAR: 131_400,
      JEEP_SUV: 131_400,
      PICKUP_SMALL_LORRY: 150_900,
      MINIBUS_VAN: 153_600,
      BUS: 153_600,
    },
    goods: {
      MOTORCYCLE: 103_606,
      CAR: 150_900,
      JEEP_SUV: 150_900,
      MINIBUS_VAN: 165_990,
      BUS: 165_990,
      PICKUP_SMALL_LORRY: 150_900,
      HOWO_SHACMAN_FUSO_FAW: 378_000,
      TRUCK_LORRY_5T_PLUS: 226_800,
      TRAILER: 129_600,
    },
    flammableUpliftOnGoods: 0.2,
  },
  otf: {
    privateUse: {
      MOTORCYCLE: otf(0.0456, 0.0357, 0.0033),
      CAR: otf(0.0297, 0.0044, 0.003),
      JEEP_SUV: otf(0.0246, 0.0037, 0.0025),
      PICKUP_SMALL_LORRY: otf(0.0258, 0.0039, 0.0026),
      MINIBUS_VAN: otf(0.0256, 0.0038, 0.003),
      BUS: otf(0.026, 0.0038, 0.003),
    },
    commercialPassenger: {
      MOTORCYCLE: otf(0.0695, 0.0736, 0.0054),
      CAR: otf(0.0282, 0.0071, 0.0038),
      JEEP_SUV: otf(0.0282, 0.0071, 0.0038),
      MINIBUS_VAN: otf(0.0317, 0.0091, 0.0046),
      BUS: otf(0.0317, 0.0091, 0.0046),
      PICKUP_SMALL_LORRY: otf(0.0313, 0.0079, 0.0042),
    },
    commercialGoods: {
      PICKUP_SMALL_LORRY: otf(0.028, 0.0042, 0.0028),
      HOWO_SHACMAN_FUSO_FAW: otf(0.042, 0.0063, 0.0042),
      TRUCK_LORRY_5T_PLUS: otf(0.028, 0.0042, 0.0028),
      TRAILER: otf(0.028, 0.0042, 0.0028),
      MINIBUS_VAN: otf(0.0317, 0.0091, 0.0046),
      BUS: otf(0.0317, 0.0091, 0.0046),
      MOTORCYCLE: otf(0.0695, 0.0736, 0.0054),
      CAR: otf(0.0282, 0.0071, 0.0038),
      JEEP_SUV: otf(0.0282, 0.0071, 0.0038),
    },
    specialEngine: {
      SPECIAL_ENGINE: otf(0.0334, 0.0051, 0.0028),
    },
  },
  mandatoryExcess: BK_PROVIDER.mandatoryExcess,
  notes: ["Prime also publishes Glass Breakage extension rates; not applied by default."],
};
