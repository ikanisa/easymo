import { WA_BOT_NUMBER_E164 } from "../config.ts";

export function buildWaLink(prefill: string): string {
  if (!WA_BOT_NUMBER_E164) return "";
  const digits = WA_BOT_NUMBER_E164.replace(/^\+/, "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(prefill)}`;
}
