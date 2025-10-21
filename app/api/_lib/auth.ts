import { z } from 'zod';
import { jsonError } from './http';

const userIdSchema = z.string().uuid();

export type AuthContext = {
  userId: string;
  roles: string[];
  msisdn?: string | null;
};

function parseRoles(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

export function getAuthContext(request: Request): AuthContext | null {
  const headers = request.headers;
  const userIdRaw = headers.get('x-user-id')?.trim();
  if (!userIdRaw) return null;

  const result = userIdSchema.safeParse(userIdRaw);
  if (!result.success) {
    return null;
  }

  const rolesHeader = headers.get('x-user-roles') ?? headers.get('x-user-role');
  const roles = parseRoles(rolesHeader);
  const msisdn = headers.get('x-user-msisdn');

  return {
    userId: result.data,
    roles,
    msisdn,
  };
}

export function requireAuth(
  request: Request,
  options: { requireRole?: 'user' | 'driver' | 'admin'; allowAdmin?: boolean } = {},
): AuthContext | Response {
  const context = getAuthContext(request);
  if (!context) {
    return jsonError({ error: 'unauthorized' }, 401);
  }

  if (options.requireRole) {
    const roles = new Set(context.roles);
    if (options.requireRole === 'driver') {
      if (!roles.has('driver')) {
        if (options.allowAdmin && roles.has('admin')) {
          return context;
        }
        return jsonError({ error: 'forbidden' }, 403);
      }
    } else if (options.requireRole === 'admin') {
      if (!roles.has('admin')) {
        return jsonError({ error: 'forbidden' }, 403);
      }
    } else if (options.requireRole === 'user') {
      if (!(roles.has('user') || roles.has('driver') || roles.has('admin'))) {
        return jsonError({ error: 'forbidden' }, 403);
      }
    }
  }

  return context;
}
