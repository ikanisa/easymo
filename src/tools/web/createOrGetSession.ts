import type { CreateOrGetSessionInput, WebSessionRecord } from "../../web/sessionService";
import { createOrGetSession } from "../../web/sessionService";

export type WebCreateOrGetSessionInput = CreateOrGetSessionInput;

export async function webCreateOrGetSession(input: WebCreateOrGetSessionInput): Promise<WebSessionRecord> {
  return createOrGetSession(input);
}
