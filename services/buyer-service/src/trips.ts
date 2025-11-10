import axios from "axios";
import { settings } from "./config";
import { logger } from "./logger";

type Trip = {
  id: number;
  role: string;
  status: string;
  creator_user_id?: string | null;
};

export async function fetchBuyerTrips(buyerRef: string): Promise<Trip[]> {
  const adminBase = process.env.EASYMO_ADMIN_API_BASE;
  if (!adminBase) return [];
  try {
    const headers: Record<string, string> = {};
    if (process.env.EASYMO_ADMIN_TOKEN) {
      headers["x-api-key"] = process.env.EASYMO_ADMIN_TOKEN;
    }
    const actorId =
      process.env.EASYMO_ADMIN_ACTOR_ID || process.env.ADMIN_TEST_ACTOR_ID || "00000000-0000-0000-0000-000000000001";
    headers["x-actor-id"] = actorId;

    const response = await axios.get(`${adminBase}/admin-trips`, {
      params: { action: "list" },
      headers,
    });
    const trips = response.data?.trips ?? [];
    return (Array.isArray(trips) ? trips : []).filter((trip) => trip.creator_user_id === buyerRef);
  } catch (error) {
    logger.warn({ msg: "buyer.trips.fetch_failed", error });
    return [];
  }
}
