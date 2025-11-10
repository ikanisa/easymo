import OpenAI from "openai";
import { z } from "zod";

export const VehicleDocSchema = z.object({
  plateNumber: z.string().optional(),
  vin: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  bodyType: z.string().optional(),
  year: z.number().int().optional(),
  usageHint: z.enum(["PRIVATE", "TAXI_PSV", "HIRE", "SCHOOL_BUS", "COMMERCIAL_GOODS", "DRIVING_SCHOOL"]).optional(),
  seats: z.number().int().optional(),
  passengersAboveDriver: z.number().int().optional(),
  engineCapacityCC: z.number().int().optional(),
  grossWeightKg: z.number().int().optional(),
  tonnage: z.number().optional(),
  previousInsurer: z.string().optional(),
  previousPolicyNumber: z.string().optional(),
  sumInsuredHint: z.number().optional(),
  ownerType: z.enum(["INDIVIDUAL", "CORPORATE"]).optional(),
});
export type VehicleDoc = z.infer<typeof VehicleDocSchema>;

export async function extractFromImages(openai: OpenAI, imageUrls: string[]): Promise<VehicleDoc> {
  const systemPrompt = "You are an intake assistant. Read Rwandan motor insurance docs (Yellow Card, Logbook, prior certificate). Extract clean JSON. Output ONLY valid JSON.";

  const userContent: Array<Record<string, unknown>> = [{ type: "text", text: "Extract the fields. If missing, omit. seats = total incl driver; passengersAboveDriver = total minus driver." }];
  imageUrls.forEach((url) => userContent.push({ type: "image_url", image_url: { url } }));

  const response = await openai.chat.completions.create({
    model: process.env.OCR_MODEL || "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent as any },
    ],
  });

  const json = response.choices[0].message.content || "{}";
  const parsed = JSON.parse(json);
  const safe = VehicleDocSchema.safeParse(parsed);
  if (!safe.success) throw new Error(`OCR parse failed: ${safe.error.message}`);
  return safe.data;
}

export type VehicleCategory =
  | "MOTORCYCLE"
  | "TRICYCLE"
  | "CAR"
  | "JEEP_SUV"
  | "PICKUP_SMALL_LORRY"
  | "MINIBUS_VAN"
  | "BUS"
  | "HOWO_SHACMAN_FUSO_FAW"
  | "TRUCK_LORRY_5T_PLUS"
  | "TRAILER"
  | "TRACTOR"
  | "SPECIAL_ENGINE";

export type UsageType =
  | "PRIVATE"
  | "TAXI_PSV"
  | "HIRE"
  | "SCHOOL_BUS"
  | "COMMERCIAL_GOODS"
  | "DRIVING_SCHOOL";

export function classifyVehicle(doc: VehicleDoc): { vehicleCategory?: VehicleCategory; usageTypeGuess?: UsageType } {
  const text = [doc.bodyType, doc.model, doc.make].filter(Boolean).join(" ").toLowerCase();
  const has = (tokens: string[]) => tokens.some((token) => text.includes(token));

  let vehicleCategory: VehicleCategory | undefined;
  if (has(["motorcycle", "bike", "moto"])) vehicleCategory = "MOTORCYCLE";
  else if (has(["tricycle", "tuk"])) vehicleCategory = "TRICYCLE";
  else if (has(["pickup", "pick-up", "canter", "hilux", "camionnette"])) vehicleCategory = "PICKUP_SMALL_LORRY";
  else if (has(["minibus", "van", "hiace", "coaster"])) vehicleCategory = "MINIBUS_VAN";
  else if (has(["bus", "coach"])) vehicleCategory = "BUS";
  else if (has(["jeep", "suv", "prado", "land cruiser", "rav4", "forester"])) vehicleCategory = "JEEP_SUV";
  else if (has(["trailer", "semi"])) vehicleCategory = "TRAILER";
  else if (has(["tractor"])) vehicleCategory = "TRACTOR";
  else if (has(["howo", "shacman", "fuso", "faw"])) vehicleCategory = "HOWO_SHACMAN_FUSO_FAW";
  else if (has(["truck", "lorry", "camion"])) vehicleCategory = "TRUCK_LORRY_5T_PLUS";
  else vehicleCategory = "CAR";

  let usageTypeGuess: UsageType | undefined = undefined;
  if (doc.usageHint) usageTypeGuess = doc.usageHint as UsageType;
  else if (has(["taxi", "psv"])) usageTypeGuess = "TAXI_PSV";
  else if (has(["school bus", "school"])) usageTypeGuess = "SCHOOL_BUS";
  else if (has(["for hire", "hire"])) usageTypeGuess = "HIRE";
  else if (has(["goods", "canter", "truck", "lorry", "camion"])) usageTypeGuess = "COMMERCIAL_GOODS";
  else usageTypeGuess = "PRIVATE";

  return { vehicleCategory, usageTypeGuess };
}
