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
  if (!process.env.EASYMO_ADMIN_API_BASE) return [];
  try {
    const response = await axios.get(`${process.env.EASYMO_ADMIN_API_BASE}/admin-trips`, {
      params: { action: "list" },
      headers: process.env.EASYMO_ADMIN_TOKEN ? { "x-api-key": process.env.EASYMO_ADMIN_TOKEN } : {},
    });
    const trips = response.data?.trips ?? [];
    return (Array.isArray(trips) ? trips : []).filter((trip) => trip.creator_user_id === buyerRef);
  } catch (error) {
    logger.warn({ msg: "buyer.trips.fetch_failed", error });
    return [];
  }
}
