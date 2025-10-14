import { headers } from 'next/headers';
import { isActorAuthorized } from '@/lib/auth/credentials';

// Looser UUID shape to tolerate test IDs and non-versioned UUIDs
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export function getActorId(): string | null {
  const value = headers().get('x-actor-id');
  if (value) {
    if (!UUID_REGEX.test(value)) return null;
    if (!isActorAuthorized(value)) {
      return null;
    }
    return value;
  }
  if (process.env.ADMIN_ALLOW_ANY_ACTOR === 'true') {
    const fallback = process.env.ADMIN_TEST_ACTOR_ID ?? '00000000-0000-0000-0000-000000000001';
    if (UUID_REGEX.test(fallback)) {
      return fallback;
    }
  }
  return null;
}

export function requireActorId(): string {
  const actorId = getActorId();
  if (!actorId) {
    throw new UnauthorizedError('Missing or invalid x-actor-id header.');
  }
  return actorId;
}
