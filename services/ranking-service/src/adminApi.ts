import axios from "axios";
import { settings } from "./config";
import { logger } from "./logger";

type Trip = {
  id: number;
  role: string;
  status: string;
  created_at: string;
  vendor_ref?: string | null;
};

export async function fetchRecentTrips(limit = 50): Promise<Trip[]> {
  if (!settings.easymoAdminApiBase) return [];
  try {
    const headers: Record<string, string> = {};
    if (settings.easymoAdminToken) {
      headers["x-api-key"] = settings.easymoAdminToken;
    }
    const actorId =
      settings.easymoAdminActorId || process.env.ADMIN_TEST_ACTOR_ID || "00000000-0000-0000-0000-000000000001";
    headers["x-actor-id"] = actorId;

    const response = await axios.get(`${settings.easymoAdminApiBase}/admin-trips`, {
      params: { action: "list", limit },
      headers,
    });
    const trips = response.data?.trips ?? [];
    return Array.isArray(trips) ? trips : [];
  } catch (error) {
    logger.warn({ msg: "ranking.trips.fetch_failed", error });
    return [];
  }
}
