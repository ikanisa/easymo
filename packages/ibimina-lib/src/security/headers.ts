import { SECURITY_HEADERS } from "./constants";

export { HSTS_HEADER, SECURITY_HEADERS } from "./constants";

export function createSecureHeaders(): Array<{ key: string; value: string }> {
  return [...SECURITY_HEADERS];
}
