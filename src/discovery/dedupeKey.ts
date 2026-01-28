import { createHash } from "node:crypto";

export type DedupeInput = {
  name?: string;
  phones?: string[];
  website?: string;
};

export function buildDedupeKey(input: DedupeInput): string {
  const normalizedName = (input.name ?? "").trim().toLowerCase();
  const normalizedWebsite = (input.website ?? "").trim().toLowerCase();
  const normalizedPhones = (input.phones ?? [])
    .map((phone) => phone.replace(/\D/g, ""))
    .filter(Boolean)
    .sort()
    .join("|");

  const seed = [normalizedName, normalizedWebsite, normalizedPhones].join("::");
  return createHash("sha256").update(seed).digest("hex");
}
