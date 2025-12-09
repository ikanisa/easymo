export type ImportFieldKey =
  | "full_name"
  | "msisdn"
  | "member_code"
  | "occurredAt"
  | "txnId"
  | "amount"
  | "reference";

export interface ValidationMask {
  id: string;
  label: string;
  description?: string;
  sample?: string;
}

export interface MaskedValue<TValue> {
  value: TValue;
  valid: boolean;
  reason?: string;
}

const MEMBER_MASK_OPTIONS: Record<
  Exclude<ImportFieldKey, "occurredAt" | "txnId" | "amount" | "reference">,
  ValidationMask[]
> = {
  full_name: [
    {
      id: "trim",
      label: "Trim spacing",
      description: "Collapse multiple spaces and trim leading/trailing characters.",
    },
    {
      id: "title",
      label: "Title Case",
      description: "Convert to title case while trimming whitespace.",
    },
  ],
  msisdn: [
    {
      id: "auto-rw",
      label: "Normalize Rwandan",
      description: "Strip non-numeric characters and format to 07########.",
      sample: "0788123456",
    },
    {
      id: "keep",
      label: "Keep exactly",
      description: "Keep value as provided (still trimmed).",
    },
  ],
  member_code: [
    {
      id: "trim",
      label: "Trim spacing",
    },
    {
      id: "upper",
      label: "Uppercase",
      description: "Uppercase member codes after trimming.",
    },
  ],
};

const STATEMENT_MASK_OPTIONS: Record<
  Extract<ImportFieldKey, "occurredAt" | "txnId" | "msisdn" | "amount" | "reference">,
  ValidationMask[]
> = {
  occurredAt: [
    {
      id: "auto",
      label: "Auto-detect",
      description: "Supports ISO, YYYY-MM-DD HH:mm, DD/MM/YYYY HH:mm, and Excel exports.",
    },
    {
      id: "day-first",
      label: "DD/MM/YYYY",
      description: "Parse day-first formats with optional time (DD/MM/YYYY HH:mm).",
    },
  ],
  txnId: [
    {
      id: "trim",
      label: "Trim spacing",
    },
    {
      id: "upper",
      label: "Uppercase",
    },
  ],
  msisdn: MEMBER_MASK_OPTIONS.msisdn,
  amount: [
    {
      id: "numeric",
      label: "Strip separators",
      description: "Remove commas, currency text, and parse as a positive number.",
      sample: "125000",
    },
    {
      id: "keep",
      label: "Keep exactly",
      description: "Keep numeric string but still validate it is a positive number.",
    },
  ],
  reference: [
    {
      id: "trim",
      label: "Trim spacing",
    },
    {
      id: "upper",
      label: "Uppercase",
    },
  ],
};

export const DEFAULT_MEMBER_MASKS: Record<keyof typeof MEMBER_MASK_OPTIONS, string> = {
  full_name: "trim",
  msisdn: "auto-rw",
  member_code: "trim",
};

export const DEFAULT_STATEMENT_MASKS: Record<keyof typeof STATEMENT_MASK_OPTIONS, string> = {
  occurredAt: "auto",
  txnId: "trim",
  msisdn: "auto-rw",
  amount: "numeric",
  reference: "trim",
};

export function getMaskOptions(field: ImportFieldKey): ValidationMask[] {
  if (field in MEMBER_MASK_OPTIONS) {
    return MEMBER_MASK_OPTIONS[field as keyof typeof MEMBER_MASK_OPTIONS];
  }
  if (field in STATEMENT_MASK_OPTIONS) {
    return STATEMENT_MASK_OPTIONS[field as keyof typeof STATEMENT_MASK_OPTIONS];
  }
  return [];
}

const MSISDN_REGEX = /^(?:\+?250)?0?7\d{8}$/;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function sanitizeMsisdn(value: string | null, maskId: string): MaskedValue<string> {
  const raw = normalizeWhitespace(value ?? "");
  if (!raw) {
    return { value: "", valid: false, reason: "Missing MSISDN" };
  }

  if (maskId === "keep") {
    const formatted = raw.replace(/\s+/g, "");
    const normalized = formatted.startsWith("+") ? formatted.slice(1) : formatted;
    if (!MSISDN_REGEX.test(formatted) && !MSISDN_REGEX.test(normalized)) {
      return { value: formatted, valid: false, reason: "Invalid MSISDN" };
    }
    return { value: formatted, valid: true };
  }

  const digitsOnly = raw.replace(/\D/g, "");
  let normalized = digitsOnly;
  if (digitsOnly.length === 12 && digitsOnly.startsWith("2507")) {
    normalized = `0${digitsOnly.slice(3)}`;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith("2507")) {
    normalized = `0${digitsOnly.slice(3)}`;
  } else if (digitsOnly.length === 9 && digitsOnly.startsWith("7")) {
    normalized = `0${digitsOnly}`;
  }

  if (!normalized.startsWith("07")) {
    normalized = `0${normalized}`;
  }

  if (!MSISDN_REGEX.test(normalized)) {
    return { value: normalized, valid: false, reason: "Not a valid Rwandan MSISDN" };
  }

  return { value: normalized, valid: true };
}

function sanitizeFullName(value: string | null, maskId: string): MaskedValue<string> {
  const trimmed = normalizeWhitespace(value ?? "");
  if (!trimmed) {
    return { value: "", valid: false, reason: "Missing full name" };
  }

  if (maskId === "title") {
    return { value: toTitleCase(trimmed), valid: true };
  }

  return { value: trimmed, valid: true };
}

function sanitizeMemberCode(value: string | null, maskId: string): MaskedValue<string | null> {
  const trimmed = normalizeWhitespace(value ?? "");
  if (!trimmed) {
    return { value: null, valid: true };
  }
  return { value: maskId === "upper" ? trimmed.toUpperCase() : trimmed, valid: true };
}

interface DateParseResult {
  iso: string | null;
  reason?: string;
}

function parseDateValue(rawValue: string | null, maskId: string): DateParseResult {
  const raw = normalizeWhitespace(rawValue ?? "");
  if (!raw) {
    return { iso: null, reason: "Missing date" };
  }

  const attempts: Array<() => Date | null> = [];

  const addDayFirstAttempt = () => {
    attempts.push(() => {
      const match = raw.match(
        /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:[ T](\d{1,2})(?::(\d{1,2})(?::(\d{1,2}))?)?)?$/
      );
      if (!match) return null;
      const [, dd, mm, yyyy, hh = "0", min = "0", ss = "0"] = match;
      const year = Number(yyyy.length === 2 ? `20${yyyy}` : yyyy);
      const month = Number(mm) - 1;
      const day = Number(dd);
      const hour = Number(hh);
      const minute = Number(min);
      const second = Number(ss);
      const date = new Date(year, month, day, hour, minute, second);
      return Number.isNaN(date.getTime()) ? null : date;
    });
  };

  const addIsoAttempt = () => {
    attempts.push(() => {
      const normalized = raw.replace(/ /g, "T");
      const candidate = new Date(normalized);
      return Number.isNaN(candidate.getTime()) ? null : candidate;
    });
  };

  const addGeneralAttempt = () => {
    attempts.push(() => {
      const candidate = new Date(raw);
      return Number.isNaN(candidate.getTime()) ? null : candidate;
    });
  };

  if (maskId === "day-first") {
    addDayFirstAttempt();
    addIsoAttempt();
    addGeneralAttempt();
  } else {
    addIsoAttempt();
    addDayFirstAttempt();
    addGeneralAttempt();
  }

  for (const attempt of attempts) {
    const date = attempt();
    if (date) {
      return { iso: date.toISOString() };
    }
  }

  return { iso: null, reason: "Unrecognized date format" };
}

function sanitizeAmount(value: string | null, maskId: string): MaskedValue<number> {
  const raw = normalizeWhitespace(value ?? "");
  if (!raw) {
    return { value: 0, valid: false, reason: "Missing amount" };
  }
  const numericString =
    maskId === "keep"
      ? raw.replace(/,/g, "")
      : raw
          .replace(/[^0-9.,\-]/g, "")
          .replace(/,/g, "")
          .replace(/\.(?=.*\.)/g, "");

  const amount = Number(numericString);
  if (!Number.isFinite(amount) || Number.isNaN(amount) || amount <= 0) {
    return { value: amount, valid: false, reason: "Invalid amount" };
  }
  return { value: amount, valid: true };
}

function sanitizeReference(value: string | null, maskId: string): MaskedValue<string | null> {
  const trimmed = normalizeWhitespace(value ?? "");
  if (!trimmed) {
    return { value: null, valid: true };
  }
  return { value: maskId === "upper" ? trimmed.toUpperCase() : trimmed, valid: true };
}

function sanitizeTxnId(value: string | null, maskId: string): MaskedValue<string> {
  const trimmed = normalizeWhitespace(value ?? "");
  if (!trimmed) {
    return { value: "", valid: false, reason: "Missing transaction ID" };
  }
  return { value: maskId === "upper" ? trimmed.toUpperCase() : trimmed, valid: true };
}

export function applyMask(
  field: ImportFieldKey,
  value: string | null,
  maskId: string
): MaskedValue<string | number | null> {
  switch (field) {
    case "full_name":
      return sanitizeFullName(value, maskId);
    case "msisdn":
      return sanitizeMsisdn(value, maskId);
    case "member_code":
      return sanitizeMemberCode(value, maskId);
    case "txnId":
      return sanitizeTxnId(value, maskId);
    case "amount":
      return sanitizeAmount(value, maskId);
    case "reference":
      return sanitizeReference(value, maskId);
    case "occurredAt": {
      const result = parseDateValue(value, maskId);
      if (!result.iso) {
        return { value: null, valid: false, reason: result.reason ?? "Invalid date" };
      }
      return { value: result.iso, valid: true };
    }
    default:
      return { value, valid: true };
  }
}

export type ProcessedCell = {
  value: string | number | null;
  valid: boolean;
  reason?: string;
};

export interface ProcessedRow<TRecord> {
  record: TRecord;
  errors: string[];
  cells: Record<string, ProcessedCell>;
}

export function processRow<
  TFields extends Record<string, string | null | undefined>,
  TResult extends Record<string, unknown>,
>(
  fields: { key: ImportFieldKey; maskId: string; columnKey?: string | null }[],
  row: TFields,
  buildRecord: (entries: Record<string, ProcessedCell>) => TResult
): ProcessedRow<TResult> {
  const entries: Record<string, ProcessedCell> = {};
  const errors: string[] = [];

  for (const fieldConfig of fields) {
    const raw = fieldConfig.columnKey
      ? (row[fieldConfig.columnKey as keyof TFields] ?? null)
      : null;
    const result = applyMask(fieldConfig.key, raw?.toString() ?? null, fieldConfig.maskId);
    if (!result.valid) {
      errors.push(`${fieldConfig.key}: ${result.reason ?? "Invalid value"}`);
    }
    entries[fieldConfig.key] = {
      value: result.value,
      valid: result.valid,
      reason: result.reason,
    };
  }

  return {
    record: buildRecord(entries),
    errors,
    cells: entries,
  };
}
