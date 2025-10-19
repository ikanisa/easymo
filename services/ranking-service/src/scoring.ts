import { Prisma } from "@prisma/client";

export type VendorSnapshot = {
  id: string;
  name: string;
  rating?: Prisma.Decimal | null;
  fulfilmentRate?: Prisma.Decimal | null;
  avgResponseMs?: number | null;
  totalTrips: number;
  balance?: Prisma.Decimal | null;
  recentTrips: number;
};

const ZERO = new Prisma.Decimal(0);

export function computeVendorScore(vendor: VendorSnapshot): number {
  const rating = vendor.rating ? vendor.rating.toNumber() / 5 : 0.6;
  const fulfilment = vendor.fulfilmentRate ? vendor.fulfilmentRate.toNumber() : 0.7;
  const responseScore = vendor.avgResponseMs ? Math.min(1, 3000 / vendor.avgResponseMs) : 0.5;
  const experience = vendor.totalTrips > 0 ? Math.min(1, vendor.totalTrips / 500) : 0.2;
  const recency = vendor.recentTrips > 0 ? Math.min(1, vendor.recentTrips / 20) : 0.1;
  const liquidity = vendor.balance
    ? Math.min(1, Prisma.Decimal.max(vendor.balance, ZERO).toNumber() / 500)
    : 0.3;

  const score = (
    rating * 0.3 +
    fulfilment * 0.25 +
    responseScore * 0.15 +
    experience * 0.15 +
    recency * 0.1 +
    liquidity * 0.05
  );
  return Number(score.toFixed(4));
}

export function rankVendors(vendors: VendorSnapshot[]): Array<VendorSnapshot & { score: number }> {
  return vendors
    .map((vendor) => ({ ...vendor, score: computeVendorScore(vendor) }))
    .sort((a, b) => b.score - a.score);
}
