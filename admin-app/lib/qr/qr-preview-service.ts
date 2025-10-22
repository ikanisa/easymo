import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import { shouldUseMocks } from "@/lib/runtime-config";
import { mockBars, mockQrPreview } from "@/lib/mock-data";
import type { QrPreview } from "@/lib/schemas";
import { buildQrPreview } from "@/lib/qr/qr-preview-helpers";

export interface QrPreviewRequest {
  barId: string;
  phone?: string;
  sendTest?: boolean;
}

export interface QrPreviewResponse {
  preview: QrPreview;
  integration?: {
    status: "ok" | "degraded";
    target: string;
    message?: string;
  } | null;
}

const useMocks = shouldUseMocks();

function buildMockPreview(barId: string): QrPreviewResponse {
  const bar = mockBars.find((entry) => entry.id === barId) ?? mockBars[0];
  if (!bar) {
    return { preview: mockQrPreview, integration: mockIntegration("No mock bars available.") };
  }

  const preview = buildQrPreview({
    bar: {
      id: bar.id,
      name: bar.name,
      slug: bar.slug,
      location: bar.location ?? undefined,
    },
    table: mockQrPreview.metadata.sampleTable ?? undefined,
    shareLink: mockQrPreview.metadata.shareLink ?? null,
  });

  return {
    preview,
    integration: mockIntegration("Mock preview only. Configure Supabase and WhatsApp to enable live previews."),
  };
}

function mockIntegration(message: string) {
  return {
    status: "degraded" as const,
    target: "qr_preview",
    message,
  };
}

export async function requestQrPreview(payload: QrPreviewRequest): Promise<QrPreviewResponse> {
  if (useMocks) {
    return buildMockPreview(payload.barId);
  }

  const response = await apiFetch<QrPreviewResponse, QrPreviewRequest>(getAdminApiPath("qr", "preview"), {
    method: "POST",
    body: payload,
    headers: {
      "x-idempotency-key": `qr-preview-${Date.now()}`,
    },
  });

  if (response.ok) {
    return response.data;
  }

  console.error("Failed to fetch QR preview", response.error);
  return {
    preview: mockQrPreview,
    integration: mockIntegration("Unable to load QR preview. Showing mock data."),
  };
}
