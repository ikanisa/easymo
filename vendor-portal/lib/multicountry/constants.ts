export const MULTICOUNTRY_FEATURES = [
  { value: "USSD", label: "USSD onboarding" },
  { value: "SMS_INGEST", label: "SMS ingest" },
  { value: "OCR", label: "OCR parsing" },
  { value: "NFC", label: "NFC tap to pay" },
  { value: "MANUAL_ENTRY", label: "Manual entry" },
  { value: "STATEMENTS", label: "Statement ingest" },
] as const;

export type MulticountryFeatureValue = (typeof MULTICOUNTRY_FEATURES)[number]["value"];
