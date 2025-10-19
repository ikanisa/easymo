import { PrismaService } from "@easymo/db";
import { rankVendors } from "./scoring";
import { fetchRecentTrips } from "./adminApi";

export type RankVendorsOptions = {
  tenantId: string;
  categories?: string[];
  region?: string;
};

export class RankingService {
  constructor(private readonly prisma: PrismaService) {}

  async rankVendors(options: RankVendorsOptions) {
    const vendors = await this.prisma.vendorProfile.findMany({
      where: {
        tenantId: options.tenantId,
        ...(options.region ? { region: options.region } : {}),
        ...(options.categories ? { categories: { hasSome: options.categories } } : {}),
      },
      include: {
        walletAccount: true,
      },
    });

    const recentTrips = await fetchRecentTrips(100);
    const tripsByVendor = recentTrips.reduce<Record<string, number>>((acc, trip) => {
      if (!trip.vendor_ref) return acc;
      const key = trip.vendor_ref.toLowerCase();
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const snapshots = await Promise.all(vendors.map(async (vendor) => {
      const recentQuotes = await this.prisma.quote.count({
        where: {
          vendorId: vendor.id,
          status: "accepted",
          createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14) },
        },
      });
      const recentTripsCount = tripsByVendor[vendor.name.toLowerCase()] ?? recentQuotes;
      return {
        id: vendor.id,
        name: vendor.name,
        rating: vendor.rating,
        fulfilmentRate: vendor.fulfilmentRate,
        avgResponseMs: vendor.avgResponseMs,
        totalTrips: vendor.totalTrips,
        balance: vendor.walletAccount?.balance ?? null,
        recentTrips: recentTripsCount,
      };
    }));

    return rankVendors(snapshots);
  }
}
