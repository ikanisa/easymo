import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";

/**
 * QR Code Handler
 * 
 * NOTE: QR Code functionality is handled by _shared/flows/momo/qr.ts
 * This file is a placeholder for future QR-related profile features
 * 
 * The main MoMo QR flow is imported in index.ts:
 * - startMomoQr: Displays QR code menu
 * - handleMomoButton: Handles QR code actions
 * - handleMomoText: Processes phone number input for QR generation
 */

// Re-export the MoMo QR functions for convenience
export { startMomoQr, handleMomoButton, handleMomoText } from "../../_shared/wa-webhook-shared/flows/momo/qr.ts";
