import type { RouterContext } from "../types.ts";
import { handleProfileMenu } from "../domains/profile/index.ts";

export const PROFILE_STATE_KEY = "profile_menu";

/**
 * Display the Profile menu with options for managing businesses, vehicles, and tokens
 * Delegates to the comprehensive Profile hub implementation
 */
export async function sendProfileMenu(
  ctx: RouterContext,
): Promise<void> {
  await handleProfileMenu(ctx);
}
