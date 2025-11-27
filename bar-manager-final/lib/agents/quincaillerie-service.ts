import { z } from "zod";

import { hardwareVendorSchema } from "@/lib/schemas";

const responseSchema = z.object({
  vendors: z.array(hardwareVendorSchema),
  total: z.number(),
  integration: z.object({
    status: z.enum(["ok", "degraded"]),
    target: z.string(),
    message: z.string().optional(),
    remediation: z.string().optional(),
  }),
});

export type QuincaillerieVendorsResponse = z.infer<typeof responseSchema>;

type ListParams = {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  limit?: number;
};

export async function listQuincaillerieVendors(
  params: ListParams = {},
): Promise<QuincaillerieVendorsResponse> {
  const search = new URLSearchParams();
  if (typeof params.lat === "number") search.set("lat", String(params.lat));
  if (typeof params.lng === "number") search.set("lng", String(params.lng));
  if (typeof params.radiusKm === "number") {
    search.set("radiusKm", String(params.radiusKm));
  }
  if (typeof params.limit === "number") search.set("limit", String(params.limit));

  const url =
    "/api/agents/quincaillerie" + (search.toString() ? `?${search}` : "");
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Unable to load hardware vendors.");
  }
  const json = await response.json();
  return responseSchema.parse(json);
}

