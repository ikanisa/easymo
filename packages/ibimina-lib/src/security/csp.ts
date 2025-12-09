export type CspOptions = {
  nonce: string;
  isDev?: boolean;
  supabaseUrl?: string;
};

type DirectiveMap = Record<string, string[]>;

type AllowlistOptions = {
  connect?: boolean;
  image?: boolean;
  script?: boolean;
  style?: boolean;
};

const baseDirectives: DirectiveMap = {
  "default-src": ["'self'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
  "frame-src": ["'self'"],
  "img-src": [
    "'self'",
    "data:",
    "blob:",
    "https://images.unsplash.com",
    "https://api.qrserver.com",
  ],
  "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  "font-src": ["'self'", "https://fonts.gstatic.com"],
  "connect-src": ["'self'"],
  "worker-src": ["'self'", "blob:"],
  "manifest-src": ["'self'"],
  "media-src": ["'self'"],
  "object-src": ["'none'"],
  "prefetch-src": ["'self'"],
};

function normalizeUrl(candidate: string): string {
  if (!candidate) {
    return "";
  }

  if (/^https?:/i.test(candidate)) {
    return candidate;
  }

  return `https://${candidate}`;
}

function allowUrl(
  directives: DirectiveMap,
  candidate: string | undefined,
  { connect = true, image = false, script = false, style = false }: AllowlistOptions = {}
): void {
  if (!candidate) {
    return;
  }

  try {
    const url = new URL(normalizeUrl(candidate));
    const origin = url.origin;

    if (connect) {
      directives["connect-src"].push(origin);
      if (url.protocol === "https:") {
        directives["connect-src"].push(origin.replace(/^https:/, "wss:"));
      }
    }

    if (image) {
      directives["img-src"].push(origin);
    }

    if (script) {
      directives["script-src"] = directives["script-src"] ?? [];
      directives["script-src"].push(origin);
    }

    if (style) {
      directives["style-src"].push(origin);
    }
  } catch (error) {
    console.warn("Invalid URL provided for CSP allowlist", candidate, error);
  }
}

function serializeDirectives(map: DirectiveMap): string {
  return Object.entries(map)
    .map(([key, values]) => {
      const uniqueValues = Array.from(new Set(values)).filter((value) => value.trim().length > 0);
      return uniqueValues.length > 0 ? `${key} ${uniqueValues.join(" ")}` : key;
    })
    .join("; ");
}

export function createContentSecurityPolicy({
  nonce,
  isDev = false,
  supabaseUrl,
}: CspOptions): string {
  const directives: DirectiveMap = JSON.parse(JSON.stringify(baseDirectives));

  directives["script-src"] = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];

  if (isDev) {
    directives["script-src"].push("'unsafe-eval'");
    directives["connect-src"].push("ws://localhost:3100", "ws://127.0.0.1:3100");
  }

  if (supabaseUrl) {
    try {
      const { origin } = new URL(supabaseUrl);
      const websocketOrigin = origin.replace(/^https:/, "wss:");
      directives["connect-src"].push(origin, websocketOrigin);
      directives["img-src"].push(`${origin}/storage/v1/object/public`);
    } catch (error) {
      console.warn("Invalid Supabase URL provided for CSP", error);
    }
  }

  allowUrl(directives, process.env.NEXT_PUBLIC_SITE_URL, { connect: true, image: true });
  allowUrl(directives, process.env.SITE_URL, { connect: true, image: true });
  allowUrl(directives, process.env.NEXT_PUBLIC_POSTHOG_HOST ?? process.env.POSTHOG_HOST, {
    connect: true,
    image: true,
    script: true,
  });

  const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;
  allowUrl(directives, sentryDsn, { connect: true });

  directives["style-src"].push("https://rsms.me/inter/inter.css");
  directives["img-src"].push("https://avatars.githubusercontent.com");

  directives["upgrade-insecure-requests"] = [""];

  return serializeDirectives(directives);
}
