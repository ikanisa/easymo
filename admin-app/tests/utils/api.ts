import { getAdminApiPath } from "@/lib/routes";

const TEST_ORIGIN = "http://localhost" as const;

type QueryInit = string | URLSearchParams | undefined;

const resolveQueryString = (query: QueryInit) => {
  if (!query) return "";
  if (typeof query === "string") {
    return query.startsWith("?") ? query : `?${query}`;
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
};

export const getAdminApiUrl = (
  segments: ReadonlyArray<string | number>,
  query?: QueryInit,
) => {
  const path = getAdminApiPath(...segments);
  const url = new URL(path, TEST_ORIGIN);
  const search = resolveQueryString(query);
  url.search = search;
  return url.toString();
};

export const createAdminApiRequest = (
  segments: ReadonlyArray<string | number>,
  init?: RequestInit,
  query?: QueryInit,
) => new Request(getAdminApiUrl(segments, query), init);
