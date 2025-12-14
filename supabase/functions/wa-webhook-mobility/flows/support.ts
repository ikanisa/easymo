import { maskE164 } from "../../_shared/wa-webhook-shared/utils/text.ts";

export function maskPhone(e164: string): string {
  return maskE164(e164);
}
