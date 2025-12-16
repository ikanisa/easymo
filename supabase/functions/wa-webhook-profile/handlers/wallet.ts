import type { RouterContext } from "../../_shared/wa-webhook-shared/types.ts";

/**
 * Wallet Handler Documentation
 *
 * NOTE: Wallet functionality is NOT handled by wa-webhook-profile service.
 *
 * This microservice (wa-webhook-profile) focuses on personal profile features:
 * - Edit profile (name, language)
 * - Saved locations
 * - QR code generation
 *
 * Wallet features (balance, transfers, earn tokens) are accessed through
 * the main menu, which routes to wa-webhook-wallet service.
 *
 * This file exists for documentation purposes to clarify the service boundary.
 * No wallet functionality is implemented here.
 */

// Wallet is handled by wa-webhook-wallet service
// Users access it through: Main Menu → "Wallet & Tokens" → wa-webhook-wallet
