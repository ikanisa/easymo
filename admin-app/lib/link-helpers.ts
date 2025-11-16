import type { UrlObject } from "url";

const ABSOLUTE_HREF_REGEX = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;

/**
 * Converts arbitrary href strings (including those with query/hash segments)
 * into UrlObject instances that satisfy Next.js typed routes.
 */
export function toLinkHref(href: string): UrlObject {
  if (!href) {
    return { pathname: "/" };
  }

  if (ABSOLUTE_HREF_REGEX.test(href)) {
    try {
      const parsed = new URL(href);
      const query = parsed.search ? parsed.search.slice(1) : undefined;
      const auth =
        parsed.username || parsed.password
          ? [parsed.username, parsed.password].filter(Boolean).join(":")
          : undefined;

      return {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        host: parsed.host,
        pathname: parsed.pathname || "/",
        search: parsed.search || undefined,
        query,
        hash: parsed.hash || undefined,
        slashes: true,
        auth,
      };
    } catch {
      return { pathname: "/" };
    }
  }

  let working = href.trim();
  let hash: string | undefined;

  const hashIndex = working.indexOf("#");
  if (hashIndex >= 0) {
    hash = working.slice(hashIndex);
    working = working.slice(0, hashIndex);
  }

  let search: string | undefined;
  const searchIndex = working.indexOf("?");
  if (searchIndex >= 0) {
    search = working.slice(searchIndex);
    working = working.slice(0, searchIndex);
  }

  let pathname = working || "/";
  if (!pathname.startsWith("/")) {
    pathname = `/${pathname}`;
  }

  const result: UrlObject = { pathname };

  if (search) {
    result.search = search;
    result.query = search.slice(1);
  }

  if (hash) {
    result.hash = hash;
  }

  return result;
}

