import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";

/**
 * QR Code Handler
 * 
 * MoMo QR Code functionality is handled by shared flows in:
 * `_shared/wa-webhook-shared/flows/momo/qr.ts`
 * 
 * The main index.ts properly imports and routes to these functions:
 * - startMomoQr: Displays QR code menu options
 * - handleMomoButton: Handles QR code action buttons  
 * - handleMomoText: Processes phone number input for QR generation
 * 
 * This file exists to re-export these functions for convenience and documentation.
 * The actual implementation is in the shared flows to avoid duplication across services.
 */

// Re-export the MoMo QR functions from shared flows
export { 
  startMomoQr, 
  handleMomoButton, 
  handleMomoText 
} from "../../_shared/wa-webhook-shared/flows/momo/qr.ts";
