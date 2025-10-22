const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, "");

const normalizeSegments = (segments: ReadonlyArray<string>) =>
  segments
    .flatMap((segment) => trimSlashes(segment).split("/")
      .map((part) => part.trim())
      .filter((part) => part.length > 0))
    .map((segment) => encodeURIComponent(segment));

export const ADMIN_API_BASE_PATH = "/api" as const;

export function getAdminApiPath(...segments: ReadonlyArray<string | number>) {
  const normalized = normalizeSegments(["api", ...segments.map((segment) => String(segment))]);
  return `/${normalized.join("/")}`;
}
