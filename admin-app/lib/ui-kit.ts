export function isUiKitEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_UI_KIT_ENABLED ?? process.env.UI_KIT_ENABLED ?? "false";
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}
