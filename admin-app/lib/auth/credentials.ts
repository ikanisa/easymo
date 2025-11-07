// Simple admin authorization - checks if actor ID matches configured admin
const ADMIN_ACTOR_ID = process.env.ADMIN_ACTOR_ID || "00000000-0000-0000-0000-000000000001";

export function isActorAuthorized(actorId: string): boolean {
  return actorId === ADMIN_ACTOR_ID;
}

