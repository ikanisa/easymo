import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
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

export async function requestQrPreview(payload: QrPreviewRequest): Promise<QrPreviewResponse> {
  try {
    const response = await apiFetch<QrPreviewResponse>(getAdminApiPath("qr", "preview"), {
      method: "POST",
      body: payload,
      headers: {
        "x-idempotency-key": `qr-preview-${Date.now()}`,
      },
    });

    return response;
  } catch (error) {
    console.error("Failed to fetch QR preview", error);
    throw new Error("Unable to load QR preview.");
  }
}
