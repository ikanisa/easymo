import { ShortTermBand } from "./types";

export function roundRwf(value: number): number {
  return Math.round(value);
}

export function defaultShortTermBands(): ShortTermBand[] {
  return [
    { minDays: 1, maxDays: 1, factor: 0.05 },
    { minDays: 2, maxDays: 3, factor: 0.075 },
    { minDays: 4, maxDays: 8, factor: 0.1 },
    { minDays: 9, maxDays: 15, factor: 0.125 },
    { minDays: 16, maxDays: 30, factor: 0.25 },
    { minDays: 31, maxDays: 60, factor: 0.4 },
    { minDays: 61, maxDays: 90, factor: 0.5 },
    { minDays: 91, maxDays: 120, factor: 0.6 },
    { minDays: 121, maxDays: 150, factor: 0.7 },
    { minDays: 151, maxDays: 180, factor: 0.75 },
    { minDays: 181, maxDays: 210, factor: 0.9 },
    { minDays: 211, maxDays: 366, factor: 1 }
  ];
}

export function shortTermFactor(days: number, bands: ShortTermBand[]): number {
  const d = Math.max(1, Math.min(366, Math.round(days)));
  const found = bands.find((band) => d >= band.minDays && d <= band.maxDays);
  return found ? found.factor : 1;
}
