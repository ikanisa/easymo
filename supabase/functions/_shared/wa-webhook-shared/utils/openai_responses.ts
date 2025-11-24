const DIRECT_TEXT_KEYS = ["output_text", "text", "data", "value"] as const;
const NESTED_KEYS = [
  "content",
  "output",
  "outputs",
  "message",
  "messages",
  "choices",
  "delta",
  "result",
  "response",
  "results",
] as const;

function pickText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function resolveOpenAiResponseText(payload: unknown): string | null {
  const seen = new Set<unknown>();

  function visit(value: unknown): string | null {
    if (typeof value === "string") {
      return pickText(value);
    }
    if (!value || typeof value !== "object") {
      return null;
    }
    if (seen.has(value)) {
      return null;
    }
    seen.add(value);

    for (const key of DIRECT_TEXT_KEYS) {
      const text = pickText((value as Record<string, unknown>)[key]);
      if (text) return text;
    }

    const record = value as Record<string, unknown>;
    for (const key of NESTED_KEYS) {
      const nested = record[key];
      if (!nested) continue;
      if (Array.isArray(nested)) {
        for (const entry of nested) {
          const result = visit(entry);
          if (result) return result;
        }
      } else {
        const result = visit(nested);
        if (result) return result;
      }
    }

    return null;
  }

  return visit(payload);
}

export function extractOpenAiContentText(content: unknown): string | null {
  if (!content) return null;
  if (typeof content === "string") {
    return pickText(content);
  }
  if (Array.isArray(content)) {
    for (const entry of content) {
      const text = extractOpenAiContentText(entry);
      if (text) return text;
    }
    return null;
  }
  if (typeof content === "object") {
    const direct = resolveOpenAiResponseText(content);
    if (direct) return direct;
  }
  return null;
}

