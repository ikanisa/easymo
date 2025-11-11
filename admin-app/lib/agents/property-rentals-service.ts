import { z } from "zod";
import { propertyListingSchema } from "@/lib/schemas";

const responseSchema = z.object({
  properties: z.array(propertyListingSchema),
  integration: z.object({
    status: z.enum(["ok", "degraded"]),
    target: z.string(),
    message: z.string().optional(),
    remediation: z.string().optional(),
  }),
});

export type PropertyListingsResponse = z.infer<typeof responseSchema>;

type ListParams = {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  rentalType?: string;
  bedrooms?: number;
  minBudget?: number;
  maxBudget?: number;
};

export async function listPropertyListings(
  params: ListParams = {},
): Promise<PropertyListingsResponse> {
  const search = new URLSearchParams();
  if (typeof params.lat === "number") search.set("lat", String(params.lat));
  if (typeof params.lng === "number") search.set("lng", String(params.lng));
  if (typeof params.radiusKm === "number") {
    search.set("radiusKm", String(params.radiusKm));
  }
  if (params.rentalType) search.set("rentalType", params.rentalType);
  if (typeof params.bedrooms === "number") {
    search.set("bedrooms", String(params.bedrooms));
  }
  if (typeof params.minBudget === "number") {
    search.set("minBudget", String(params.minBudget));
  }
  if (typeof params.maxBudget === "number") {
    search.set("maxBudget", String(params.maxBudget));
  }

  const url =
    "/api/agents/property-rentals" + (search.toString() ? `?${search}` : "");
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Unable to load properties.");
  }
  const json = await response.json();
  return responseSchema.parse(json);
}

