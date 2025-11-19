export type FarmerBrokerIntent = "farmer_supply" | "buyer_demand";

export type FarmerBrokerProfile = {
  id?: string;
  locale?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type FarmerBrokerFarm = {
  id?: string;
  farm_name?: string | null;
  district?: string | null;
  sector?: string | null;
  region?: string | null;
  hectares?: number | null;
  commodities?: string[] | null;
  certifications?: string[] | null;
  irrigation?: boolean | null;
  metadata?: Record<string, unknown> | null;
  farm_synonyms?: Array<{ phrase: string; locale?: string | null; category?: string | null }>;
};

export type FarmerBrokerInput = {
  msisdn: string;
  message: string;
  intent: FarmerBrokerIntent;
  locale?: string | null;
  conversationId?: string | null;
  profile?: FarmerBrokerProfile;
  farm?: FarmerBrokerFarm;
  buyerContext?: { market?: string; requestedMessage?: string } | null;
};

export type FarmerBrokerBuildResult = {
  messages: Array<{ role: "system" | "user"; content: string }>;
  metadata: Record<string, string>;
  locale: string;
};

const FARMER_SYSTEM_PROMPT = `Uri "Umuhuza w'Abahinzi" wa EasyMO. Ufasha abahinzi n'ibimina gusangira amakuru y'ubuhinzi.
- Subiza mu Kinyarwanda gisa neza kandi wongeremo amagambo make y'Icyongereza asobanura ibipimo cyangwa ibiciro.
- Shishikariza guhuriza ibicuruzwa hamwe muri pickup windows kugirango imodoka imwe ibe yakira ibintu byinshi.
- Sobanura uburyo bwo kwishyura deposit hagati ya 20%-30% kugira ngo hazigamwa umwanya w'ikarita yo guterura.`;

const BUYER_SYSTEM_PROMPT = `You are EasyMO's Kigali buyer liaison. Help Kigali buyers understand available farm supply.
- Greet briefly in Kinyarwanda then explain next steps in clear English tailored to Kigali wholesale/retail buyers.
- Explain pooled pickup windows, potential cooperatives, and optional 20%-30% reservation deposits.
- Always offer two concrete follow-up actions (eg. confirm tonnage, share delivery timeline).`;

const SYNONYM_LIMIT = 5;

const normalizeLocale = (value?: string | null) => {
  if (!value) return "rw";
  return value.toLowerCase();
};

const readMetadataLocale = (profile?: FarmerBrokerProfile) => {
  if (!profile?.metadata || typeof profile.metadata !== "object") {
    return null;
  }
  const metadata = profile.metadata as Record<string, unknown>;
  const preferred = metadata.preferred_language;
  if (typeof preferred === "string" && preferred.trim().length >= 2) {
    return preferred;
  }
  if (typeof metadata.locale === "string") {
    return metadata.locale;
  }
  if (metadata.farmer_profile && typeof metadata.farmer_profile === "object") {
    const farmerProfile = metadata.farmer_profile as Record<string, unknown>;
    const farmerLocale = farmerProfile.preferred_language;
    if (typeof farmerLocale === "string") {
      return farmerLocale;
    }
  }
  return null;
};

const describeFarm = (farm?: FarmerBrokerFarm | null) => {
  if (!farm) return null;
  const details: string[] = [];
  if (farm.farm_name) details.push(`Farm: ${farm.farm_name}`);
  if (farm.district) details.push(`District: ${farm.district}${farm.sector ? `/${farm.sector}` : ""}`);
  if (farm.region && !farm.district?.match(/kigali/i)) details.push(`Region: ${farm.region}`);
  if (farm.hectares) details.push(`Hectares: ${farm.hectares}`);
  if (farm.commodities?.length) details.push(`Commodities: ${farm.commodities.join(", ")}`);
  if (typeof farm.irrigation === "boolean") details.push(`Irrigation: ${farm.irrigation ? "yes" : "no"}`);
  if (farm.certifications?.length) details.push(`Certifications: ${farm.certifications.join(", ")}`);
  if (farm.farm_synonyms?.length) {
    const terms = farm.farm_synonyms
      .slice(0, SYNONYM_LIMIT)
      .map((entry) => `${entry.phrase}${entry.category ? ` (${entry.category})` : ""}`)
      .join(", ");
    details.push(`Synonyms: ${terms}`);
  }
  return details.join(" | ");
};

const describeBuyer = (buyer?: FarmerBrokerInput["buyerContext"]) => {
  if (!buyer) return null;
  const parts: string[] = [];
  if (buyer.market) {
    parts.push(`Focus market: ${buyer.market}`);
  }
  if (buyer.requestedMessage) {
    parts.push(`Buyer request: ${buyer.requestedMessage}`);
  }
  return parts.length ? parts.join(" | ") : null;
};

const describeFarmerProfile = (profile?: FarmerBrokerProfile) => {
  if (!profile?.metadata || typeof profile.metadata !== "object") {
    return null;
  }
  const data = profile.metadata as Record<string, unknown>;
  if (!data.farmer_profile || typeof data.farmer_profile !== "object") {
    return null;
  }
  const farmerProfile = data.farmer_profile as Record<string, unknown>;
  const attributes: string[] = [];
  if (typeof farmerProfile.label === "string") {
    attributes.push(`Label: ${farmerProfile.label}`);
  }
  if (typeof farmerProfile.district === "string") {
    attributes.push(`District: ${farmerProfile.district}`);
  }
  if (typeof farmerProfile.sector === "string") {
    attributes.push(`Sector: ${farmerProfile.sector}`);
  }
  if (typeof farmerProfile.hectares === "number") {
    attributes.push(`Size: ${farmerProfile.hectares} ha`);
  }
  if (Array.isArray(farmerProfile.commodities)) {
    attributes.push(`Commodities: ${(farmerProfile.commodities as string[]).join(", ")}`);
  }
  if (typeof farmerProfile.distribution_focus === "string") {
    attributes.push(`Distribution: ${farmerProfile.distribution_focus}`);
  }
  if (typeof farmerProfile.irrigation === "boolean") {
    attributes.push(`Irrigation: ${farmerProfile.irrigation ? "yes" : "no"}`);
  }
  return attributes.length ? attributes.join(" | ") : null;
};

const toMetadataRecord = (metadata: Record<string, string | null | undefined>): Record<string, string> => {
  return Object.entries(metadata).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value === undefined || value === null) {
      return acc;
    }
    acc[key] = String(value);
    return acc;
  }, {});
};

export function buildFarmerBrokerMessages(input: FarmerBrokerInput): FarmerBrokerBuildResult {
  const metadataLocale = readMetadataLocale(input.profile);
  const locale = normalizeLocale(input.locale ?? metadataLocale ?? input.profile?.locale ?? "rw");
  const contextSections: string[] = [];
  const farmerProfile = describeFarmerProfile(input.profile);
  if (farmerProfile) contextSections.push(farmerProfile);
  const farmSummary = describeFarm(input.farm);
  if (farmSummary) contextSections.push(farmSummary);
  const buyerSummary = describeBuyer(input.buyerContext ?? undefined);
  if (buyerSummary) contextSections.push(buyerSummary);
  const contextBlock = contextSections.length ? `Context:\n- ${contextSections.join("\n- ")}` : "Context: none";

  const systemPrompt = input.intent === "farmer_supply" ? FARMER_SYSTEM_PROMPT : BUYER_SYSTEM_PROMPT;
  const tone = input.intent === "farmer_supply"
    ? "Tone: be warm, practical, and community-first in Kinyarwanda while clarifying logistics."
    : "Tone: greet in Kinyarwanda (<=6 words) then use concise Kigali business English.";

  const questions = input.intent === "farmer_supply"
    ? "Ask about harvest timing, quantity ready for pickup, and confirm if they can contribute to a pooled Kigali trip."
    : "Clarify buyer volume, delivery expectations into Kigali, and whether they can place a refundable deposit.";

  const userPrompt = [
    contextBlock,
    questions,
    `Incoming WhatsApp (${locale}): """${input.message.trim()}"""`,
    "Answer with <=2 short paragraphs plus a next-step checklist.",
  ].join("\n\n");

  const messages: FarmerBrokerBuildResult["messages"] = [
    { role: "system", content: `${systemPrompt}\n\n${tone}` },
    { role: "user", content: userPrompt },
  ];

  const metadata = toMetadataRecord({
    intent: input.intent,
    locale,
    msisdn: input.msisdn,
    conversationId: input.conversationId ?? undefined,
    profileId: input.profile?.id ?? undefined,
    farmId: input.farm?.id ?? undefined,
    buyerMarket: input.buyerContext?.market ?? undefined,
  });

  return { messages, metadata, locale };
}
