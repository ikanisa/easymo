import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import {
  listPharmacyRequests,
  type PharmacyRequestsResponse,
} from "@/lib/agents/pharmacy-service";

const PHARMACY_REQUESTS_KEY: QueryKey = ["agents", "pharmacy", "requests"];

export function fetchPharmacyRequests() {
  return listPharmacyRequests();
}

type PharmacyRequestsQueryOptions = Omit<
  UseQueryOptions<PharmacyRequestsResponse, unknown, PharmacyRequestsResponse>,
  "queryKey" | "queryFn"
>;

export function usePharmacyRequestsQuery(
  options?: PharmacyRequestsQueryOptions,
) {
  return useQuery({
    queryKey: PHARMACY_REQUESTS_KEY,
    queryFn: fetchPharmacyRequests,
    staleTime: 20_000,
    ...options,
  });
}

export const pharmacyQueryKeys = {
  requests: () => PHARMACY_REQUESTS_KEY,
};
