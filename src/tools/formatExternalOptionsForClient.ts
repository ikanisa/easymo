import type { CandidateVendor } from "../discovery/types";

export type ExternalOptionsInput = {
  language?: "en" | "fr" | "rw";
  candidates: CandidateVendor[];
};

const MAX_OPTIONS = 5;

const TEMPLATE = {
  en: {
    header: "Additional options (not yet verified in our network):",
    line: (index: number, name: string, phone?: string, website?: string, location?: string) =>
      `${index}) ${name}${location ? ` — ${location}` : ""}${phone ? ` — ${phone}` : ""}${website ? ` — ${website}` : ""}`,
    footer: "You can contact them directly to confirm availability and pricing.",
  },
  fr: {
    header: "Options supplémentaires (pas encore vérifiées dans notre réseau) :",
    line: (index: number, name: string, phone?: string, website?: string, location?: string) =>
      `${index}) ${name}${location ? ` — ${location}` : ""}${phone ? ` — ${phone}` : ""}${website ? ` — ${website}` : ""}`,
    footer: "Vous pouvez les contacter directement pour confirmer disponibilité et prix.",
  },
  rw: {
    header: "Amahitamo y’inyongera (ataragenzuwe mu bafatanyabikorwa bacu):",
    line: (index: number, name: string, phone?: string, website?: string, location?: string) =>
      `${index}) ${name}${location ? ` — ${location}` : ""}${phone ? ` — ${phone}` : ""}${website ? ` — ${website}` : ""}`,
    footer: "Mushobora kubavugisha mubonye amakuru y’ibiciro n’uko bahagaze.",
  },
};

function pickLanguage(language?: string): "en" | "fr" | "rw" {
  if (language === "fr" || language === "rw") return language;
  return "en";
}

function safePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  return phone.startsWith("+") ? phone : `+${phone}`;
}

export function formatExternalOptionsForClient(input: ExternalOptionsInput): string {
  const lang = pickLanguage(input.language);
  const template = TEMPLATE[lang];
  const lines = input.candidates.slice(0, MAX_OPTIONS).map((candidate, idx) => {
    const phone = safePhone(candidate.phones?.[0]);
    const location = candidate.address ?? candidate.area;
    return template.line(idx + 1, candidate.name, phone, candidate.website, location);
  });

  if (lines.length === 0) {
    return "";
  }

  return [template.header, ...lines, template.footer].join("\n");
}
