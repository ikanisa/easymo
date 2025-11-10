import { TariffProvider } from "../../types";
import { BK_PROVIDER } from "./BK";

export const RADIANT_PROVIDER: TariffProvider = {
  ...BK_PROVIDER,
  name: "Radiant Insurance",
  ownerTypeTpDiff: {
    corporate: {
      MOTORCYCLE: 39_000,
      CAR: 57_600,
      JEEP_SUV: 76_200,
      PICKUP_SMALL_LORRY: 86_100,
      MINIBUS_VAN: 129_600,
      BUS: 207_000,
    },
    individual: {
      MOTORCYCLE: 90_800,
      CAR: 42_000,
      JEEP_SUV: 62_000,
      PICKUP_SMALL_LORRY: 72_000,
      MINIBUS_VAN: 129_600,
      BUS: 207_000,
    },
  },
};
