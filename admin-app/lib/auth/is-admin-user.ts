import type { User } from "@supabase/supabase-js";

/**
 * Determines if a Supabase user has admin privileges.
 * Checks for "admin" role (case-insensitive) in:
 * - app_metadata.role
 * - app_metadata.roles
 * - user_metadata.role
 * - user_metadata.roles
 *
 * @param user - The Supabase user object to check
 * @returns true if the user has admin privileges, false otherwise
 */
export function isAdminUser(user: User | null): boolean {
  if (!user) return false;

  const appRole = (user.app_metadata as Record<string, unknown> | undefined)?.role;
  const userRole = (user.user_metadata as Record<string, unknown> | undefined)?.role;
  const appRoles = (user.app_metadata as Record<string, unknown> | undefined)?.roles;
  const userRoles = (user.user_metadata as Record<string, unknown> | undefined)?.roles;

  const normalize = (value: unknown) =>
    typeof value === "string"
      ? [value]
      : Array.isArray(value)
        ? (value as unknown[]).filter((entry): entry is string => typeof entry === "string")
        : [];

  const roles = [
    ...normalize(appRole),
    ...normalize(userRole),
    ...normalize(appRoles),
    ...normalize(userRoles),
  ];

  return roles.some((role) => role.toLowerCase() === "admin");
}
