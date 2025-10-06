import { QRCode } from "https://deno.land/x/qrcode@v2.0.0/mod.ts";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

function formatCurrency(amountMinor: number, currency: string): string {
  const amount = amountMinor / 1;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  return formatted;
}

function renderQrSvg(payload: string): { inner: string; size: number } {
  const svg = QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 0,
  }) as string;
  const match = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  const size = match ? Number(match[1]) : 256;
  const inner = svg.replace(/^[^>]*>/, "").replace(/<\/svg>$/, "");
  return { inner, size };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export type RenderVoucherParams = {
  code: string;
  amountMinor: number;
  currency: string;
  policyNumber: string;
  issuedAt: Date;
  qrPayload: string;
  plate?: string | null;
};

export async function renderVoucherPng(
  params: RenderVoucherParams,
): Promise<Uint8Array> {
  const amountText = formatCurrency(params.amountMinor, params.currency);
  const issuedDate = formatDate(params.issuedAt).toUpperCase();
  const { inner: qrInner, size: qrSize } = renderQrSvg(params.qrPayload);
  const qrScale = 540 / qrSize;

  const plateLine = params.plate
    ? `<tspan x="0" dy="1.2em">Plate: ${escapeXml(params.plate)}</tspan>`
    : "";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1727ff" />
        <stop offset="50%" stop-color="#6a11cb" />
        <stop offset="100%" stop-color="#1fc4ff" />
      </linearGradient>
      <linearGradient id="cardGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.35)" />
        <stop offset="100%" stop-color="rgba(255,255,255,0.15)" />
      </linearGradient>
    </defs>
    <rect width="1080" height="1920" fill="url(#bgGradient)" />
    <g filter="url(#cardShadow)">
      <rect x="80" y="160" width="920" height="1600" rx="48" fill="rgba(255,255,255,0.15)" />
      <rect x="80" y="160" width="920" height="1600" rx="48" fill="url(#cardGradient)" />
    </g>
    <text x="120" y="320" font-size="44" font-family="'Poppins', 'Helvetica', sans-serif" fill="rgba(255,255,255,0.8)" letter-spacing="3">
      ENGEN FUEL VOUCHER
    </text>
    <text x="120" y="420" font-size="32" font-family="'Poppins', 'Helvetica', sans-serif" fill="rgba(255,255,255,0.7)">
      easyMO · WhatsApp dine-in & insurance
    </text>
    <text x="120" y="560" font-size="82" font-family="'Poppins', 'Helvetica', sans-serif" fill="#ffffff" font-weight="600">
      ${escapeXml(amountText)}
    </text>
    <text x="120" y="650" font-size="34" font-family="'Poppins', 'Helvetica', sans-serif" fill="rgba(255,255,255,0.7)">
      Policy: ${escapeXml(params.policyNumber)}
    </text>
    <text x="120" y="705" font-size="28" font-family="'Poppins', 'Helvetica', sans-serif" fill="rgba(255,255,255,0.6)">
      Issued ${escapeXml(issuedDate)}
    </text>

    <g transform="translate(270, 760) scale(${qrScale})">
      ${qrInner}
    </g>

    <text x="120" y="1400" font-size="36" font-family="'Poppins', 'Helvetica', sans-serif" fill="rgba(255,255,255,0.7)">
      Voucher code
    </text>
    <text x="120" y="1480" font-size="140" font-family="'Poppins', 'Helvetica', sans-serif" fill="#ffffff" font-weight="700" letter-spacing="14">
      ${escapeXml(params.code)}
    </text>

    <text x="120" y="1600" font-size="30" font-family="'Poppins', 'Helvetica', sans-serif" fill="rgba(255,255,255,0.65)">
      <tspan x="120">Valid once · Present at any ENGEN station</tspan>
      <tspan x="120" dy="1.2em">Serial VC-${escapeXml(params.code)}-${
    escapeXml(params.qrPayload.split(":").pop() ?? "")
  }</tspan>
      ${plateLine}
    </text>

    <circle cx="940" cy="300" r="70" fill="rgba(255,255,255,0.2)" />
    <text x="940" y="315" font-size="48" text-anchor="middle" font-family="'Poppins', 'Helvetica', sans-serif" fill="#ffffff" font-weight="600">ENGEN</text>
  </svg>`;

  const image = Image.renderSVG(svg, 1080, Image.SVG_MODE_WIDTH);
  return await image.encode();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
