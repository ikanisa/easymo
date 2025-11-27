import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Prisma } from "@prisma/client";

import { computeVendorScore, rankVendors } from "../src/scoring";

describe("computeVendorScore", () => {
  it("ranks high rating vendors higher", () => {
    const high = computeVendorScore({
      id: "1",
      name: "A",
      rating: new Prisma.Decimal(4.9),
      fulfilmentRate: new Prisma.Decimal(0.95),
      avgResponseMs: 1200,
      totalTrips: 400,
      balance: new Prisma.Decimal(300),
      recentTrips: 10,
    });
    const low = computeVendorScore({
      id: "2",
      name: "B",
      rating: new Prisma.Decimal(3.5),
      fulfilmentRate: new Prisma.Decimal(0.6),
      avgResponseMs: 4000,
      totalTrips: 50,
      balance: new Prisma.Decimal(20),
      recentTrips: 1,
    });
    expect(high).toBeGreaterThan(low);
  });

  it("sorts vendors by score", () => {
    const ranked = rankVendors([
      {
        id: "1",
        name: "Alpha",
        rating: new Prisma.Decimal(4.2),
        fulfilmentRate: new Prisma.Decimal(0.9),
        avgResponseMs: 1800,
        totalTrips: 120,
        balance: new Prisma.Decimal(200),
        recentTrips: 8,
      },
      {
        id: "2",
        name: "Beta",
        rating: new Prisma.Decimal(3.8),
        fulfilmentRate: new Prisma.Decimal(0.7),
        avgResponseMs: 2500,
        totalTrips: 60,
        balance: new Prisma.Decimal(50),
        recentTrips: 3,
      },
    ]);
    expect(ranked[0].name).toBe("Alpha");
  });
});
