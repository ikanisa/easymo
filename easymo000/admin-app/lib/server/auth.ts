import { headers } from 'next/headers';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export function getActorId(): string | null {
  const value = headers().get('x-actor-id');
  if (!value) return null;
  if (!UUID_REGEX.test(value)) return null;
  return value;
}

export function requireActorId(): string {
  const actorId = getActorId();
  if (!actorId) {
    throw new UnauthorizedError('Missing or invalid x-actor-id header.');
  }
  return actorId;
}
