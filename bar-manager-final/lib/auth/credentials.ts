/**
 * Authentication credentials and authorization logic for the admin panel
 */

// List of authorized actor IDs (admins/staff)
const AUTHORIZED_ACTORS = new Set([
  '00000000-0000-0000-0000-000000000001', // Test actor for development
  // Additional actors hydrated from ADMIN_ACCESS_CREDENTIALS at runtime
]);

function hydrateAuthorizedActorsFromEnv() {
  const raw = process.env.ADMIN_ACCESS_CREDENTIALS;
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    for (const entry of parsed) {
      if (entry && typeof entry === 'object' && typeof (entry as any).actorId === 'string') {
        AUTHORIZED_ACTORS.add((entry as any).actorId);
      }
    }
  } catch (error) {
    console.warn('auth.credentials.env_parse_failed', error);
  }
}

hydrateAuthorizedActorsFromEnv();

/**
 * Check if an actor (user) is authorized to access admin functions
 * @param actorId - The actor/user UUID to check
 * @returns true if authorized, false otherwise
 */
export function isActorAuthorized(actorId: string): boolean {
  // In development, allow any actor if the flag is set
  if (process.env.ADMIN_ALLOW_ANY_ACTOR === 'true') {
    return true;
  }
  
  // Check if the actor is in the authorized list
  return AUTHORIZED_ACTORS.has(actorId);
}

/**
 * Add an actor to the authorized list (for runtime additions)
 * @param actorId - The actor UUID to authorize
 */
export function authorizeActor(actorId: string): void {
  AUTHORIZED_ACTORS.add(actorId);
}

/**
 * Remove an actor from the authorized list
 * @param actorId - The actor UUID to deauthorize
 */
export function deauthorizeActor(actorId: string): void {
  AUTHORIZED_ACTORS.delete(actorId);
}

/**
 * Get all authorized actor IDs (for debugging/testing)
 * Should not be exposed in production
 */
export function getAuthorizedActors(): string[] {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot list authorized actors in production');
  }
  return Array.from(AUTHORIZED_ACTORS);
}
