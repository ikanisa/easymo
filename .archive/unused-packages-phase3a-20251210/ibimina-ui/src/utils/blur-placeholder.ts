const cache = new Map<string, string>();

function toBase64(payload: string) {
  if (typeof window === "undefined") {
    return Buffer.from(payload).toString("base64");
  }
  return window.btoa(payload);
}

function buildShimmer(width: number, height: number, accent: string) {
  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
      <defs>
        <linearGradient id="shimmer" x1="0" x2="1" y1="0" y2="1">
          <stop stop-color="${accent}" offset="0%" stop-opacity="0.35" />
          <stop stop-color="${accent}" offset="50%" stop-opacity="0.15" />
          <stop stop-color="#ffffff" offset="100%" stop-opacity="0.25" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#shimmer)">
        <animate attributeName="opacity" values="0.35;0.15;0.35" dur="1.6s" repeatCount="indefinite" />
      </rect>
    </svg>
  `;
}

export interface BlurPlaceholderOptions {
  width?: number;
  height?: number;
  accent?: string;
}

const DEFAULT_WIDTH = 512;
const DEFAULT_HEIGHT = 320;
const DEFAULT_ACCENT = "#0b1020";

export function getBlurDataURL(options: BlurPlaceholderOptions = {}) {
  const width = Math.max(16, Math.round(options.width ?? DEFAULT_WIDTH));
  const height = Math.max(16, Math.round(options.height ?? DEFAULT_HEIGHT));
  const accent = options.accent ?? DEFAULT_ACCENT;
  const key = `${width}x${height}:${accent}`;

  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const svg = buildShimmer(width, height, accent);
  const dataUrl = `data:image/svg+xml;base64,${toBase64(svg)}`;
  cache.set(key, dataUrl);
  return dataUrl;
}
