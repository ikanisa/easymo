const WA_LIMITS = {
  BODY: 1024,
  FOOTER: 60,
  HEADER_TEXT: 60,
  SECTION_TITLE: 24,
  ROW_TITLE: 24,
  ROW_DESC: 72,
  MAX_ROWS_PER_SECTION: 10,
  MAX_BUTTONS: 3,
};

export type ListRow = { id: string; title: string; description?: string };
export type ListInput = {
  title: string;
  body: string;
  buttonText?: string;
  sectionTitle: string;
  rows: ListRow[];
};

export function validateListMessage(input: ListInput): string[] {
  const issues: string[] = [];
  if (!input || !Array.isArray(input.rows)) {
    issues.push("WA_LIST_INVALID_INPUT");
    return issues;
  }
  if (!input.rows.length) issues.push("WA_LIST_NO_ROWS");
  if (input.body && input.body.length > WA_LIMITS.BODY) {
    issues.push("WA_BODY_TOO_LONG");
  }
  if (
    input.sectionTitle && input.sectionTitle.length > WA_LIMITS.SECTION_TITLE
  ) issues.push("WA_SECTION_TITLE_TOO_LONG");
  if (input.title && input.title.length > WA_LIMITS.HEADER_TEXT) {
    issues.push("WA_HEADER_TOO_LONG");
  }
  const rowCount = Math.min(input.rows.length, WA_LIMITS.MAX_ROWS_PER_SECTION);
  for (let i = 0; i < rowCount; i++) {
    const r = input.rows[i];
    if (r.title && r.title.length > WA_LIMITS.ROW_TITLE) {
      issues.push(`WA_ROW_${i}_TITLE_TOO_LONG`);
    }
    if (r.description && r.description.length > WA_LIMITS.ROW_DESC) {
      issues.push(`WA_ROW_${i}_DESC_TOO_LONG`);
    }
  }
  if (input.rows.length > WA_LIMITS.MAX_ROWS_PER_SECTION) {
    issues.push("WA_TOO_MANY_ROWS");
  }
  return issues;
}

export function previewListPayload(input: ListInput) {
  const head = (
    s: string,
    n: number,
  ) => (typeof s === "string" ? (s.length <= n ? s : s.slice(0, n) + "…") : s);
  return {
    header: head(input.title, 30),
    section: head(input.sectionTitle, 24),
    bodyPreview: head(input.body, 40),
    rowCount: Array.isArray(input.rows) ? input.rows.length : 0,
    rows: (input.rows || []).slice(0, 3).map((r) => ({
      id: r.id,
      title: head(r.title, 24),
      desc: head(r.description ?? "", 32),
    })),
  };
}

export const WA_LIMITS_CONST = WA_LIMITS;
