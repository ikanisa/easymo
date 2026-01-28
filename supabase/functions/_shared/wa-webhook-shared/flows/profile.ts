import { handleProfileMenu } from "../domains/profile/index.ts";
import type { RouterContext } from "../types.ts";

export const PROFILE_STATE_KEY = "profile_menu";

/**
 * Display the Profile menu with options for managing tokens and sharing
 * Delegates to the comprehensive Profile hub implementation
 */
export async function sendProfileMenu(
  ctx: RouterContext,
): Promise<void> {
  await handleProfileMenu(ctx);
}
