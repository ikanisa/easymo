import type { QrPreview } from "@/lib/schemas";

export interface PreviewSourceBar {
  id: string;
  name: string;
  slug?: string | null;
  location?: string | null;
}

export interface PreviewSourceTable {
  label: string;
  qrPayload: string;
}

export interface BuildPreviewOptions {
  bar: PreviewSourceBar;
  table?: PreviewSourceTable | null;
  shareLink?: string | null;
}

function normalizeLocation(location?: string | null): string | null {
  if (!location) return null;
  const trimmed = location.trim();
  return trimmed.length ? trimmed : null;
}

export function buildQrPreview({
  bar,
  table = null,
  shareLink = null,
}: BuildPreviewOptions): QrPreview {
  const location = normalizeLocation(bar.location) ?? null;
  const bodyLines = [bar.name];
  if (location) {
    bodyLines[0] = `${bar.name} — ${location}`;
  }
  bodyLines.push("Tap View menu to order.");

  return {
    interactive: {
      header: "Choose a bar",
      body: bodyLines.join("\n"),
      buttonLabel: "Select",
      sectionTitle: "Choose what to do next",
      rows: [
        {
          id: "DINE_MENU",
          title: "View menu",
          description: "Browse the menu and order instantly.",
        },
        {
          id: "back_menu",
          title: "🏠 Home",
          description: "Return to the main menu.",
        },
      ],
    },
    fallback: ["1. View menu", "0. Main menu"],
    metadata: {
      barId: bar.id,
      barName: bar.name,
      barSlug: bar.slug ?? null,
      barLocation: location,
      shareLink: shareLink ?? null,
      sampleTable: table
        ? {
          label: table.label,
          qrPayload: table.qrPayload,
        }
        : null,
    },
  };
}

export function buildShareLink(qrPayload: string | null | undefined, waNumber?: string | null): string | null {
  if (!qrPayload) return null;
  const digits = (waNumber ?? "").replace(/[^0-9]/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(qrPayload)}`;
}
