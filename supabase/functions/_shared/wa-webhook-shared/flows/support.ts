import { maskE164 } from "../utils/text.ts";

export function maskPhone(e164: string): string {
  return maskE164(e164);
}
