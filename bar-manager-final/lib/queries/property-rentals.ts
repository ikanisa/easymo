import {
  type QueryKey,
  useQuery,
  type UseQueryOptions,
} from "@tanstack/react-query";

import {
  listPropertyListings,
  type PropertyListingsResponse,
} from "@/lib/agents/property-rentals-service";

const PROPERTY_LISTINGS_KEY: QueryKey = [
  "agents",
  "property",
  "listings",
];

export function fetchPropertyListings() {
  return listPropertyListings();
}

export function usePropertyListingsQuery(
  options?: UseQueryOptions<
    PropertyListingsResponse,
    unknown,
    PropertyListingsResponse
  >,
) {
  return useQuery({
    queryKey: PROPERTY_LISTINGS_KEY,
    queryFn: fetchPropertyListings,
    staleTime: 20_000,
    ...options,
  });
}

export const propertyQueryKeys = {
  listings: () => PROPERTY_LISTINGS_KEY,
};

