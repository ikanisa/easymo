/** Basic Rwanda-friendly E.164 normalizer.
 *  Accepts +2507..., 2507..., 02507..., or 07...
 */
export function normalizeE164(raw: string) {
  let s = raw.trim();
  if (!s) return "";
  if (s.startsWith("+")) return s;
  if (s.startsWith("0250")) return "+250" + s.slice(4);
  if (s.startsWith("250")) return "+250" + s.slice(3);
  if (s.startsWith("0") && s[1] === "7") return "+250" + s.slice(1);
  return s.startsWith("+") ? s : "+" + s;
}

export function parseRecipients(input: string) {
  return input
    .split(/[\n,; ]+/)
    .map((x) => normalizeE164(x))
    .filter((x) => x.length >= 10);
}

export function prettyJSON(val: unknown) {
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return "";
  }
}