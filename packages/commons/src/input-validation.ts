import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { childLogger } from './logger';

const log = childLogger({ service: 'input-validation' });

/**
 * Validation error response
 */
export class ValidationError extends Error {
  constructor(
    public readonly errors: z.ZodIssue[],
    message?: string
  ) {
    super(message || 'Validation failed');
    this.name = 'ValidationError';
  }
}

/**
 * Validate request body middleware
 * 
 * @example
 * ```typescript
 * import { validateBody } from '@easymo/commons';
 * import { z } from 'zod';
 * 
 * const schema = z.object({
 *   email: z.string().email(),
 *   age: z.number().min(18),
 * });
 * 
 * app.post('/users', validateBody(schema), (req, res) => {
 *   // req.body is now typed and validated
 *   const { email, age } = req.body;
 * });
 * ```
 */
export function validateBody<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        }));

        log.warn(
          {
            path: req.path,
            method: req.method,
            errors: formattedErrors,
          },
          'Request body validation failed'
        );

        return res.status(400).json({
          error: 'Validation failed',
          details: formattedErrors,
        });
      }

      next(error);
    }
  };
}

/**
 * Validate request query parameters
 * 
 * @example
 * ```typescript
 * import { validateQuery } from '@easymo/commons';
 * import { z } from 'zod';
 * 
 * const schema = z.object({
 *   page: z.coerce.number().min(1).default(1),
 *   limit: z.coerce.number().min(1).max(100).default(20),
 * });
 * 
 * app.get('/users', validateQuery(schema), (req, res) => {
 *   const { page, limit } = req.query;
 * });
 * ```
 */
export function validateQuery<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        }));

        log.warn(
          {
            path: req.path,
            method: req.method,
            errors: formattedErrors,
          },
          'Query parameter validation failed'
        );

        return res.status(400).json({
          error: 'Invalid query parameters',
          details: formattedErrors,
        });
      }

      next(error);
    }
  };
}

/**
 * Validate request params (URL parameters)
 * 
 * @example
 * ```typescript
 * import { validateParams } from '@easymo/commons';
 * import { z } from 'zod';
 * 
 * const schema = z.object({
 *   id: z.string().uuid(),
 * });
 * 
 * app.get('/users/:id', validateParams(schema), (req, res) => {
 *   const { id } = req.params; // typed as string (uuid validated)
 * });
 * ```
 */
export function validateParams<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params) as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        }));

        log.warn(
          {
            path: req.path,
            method: req.method,
            errors: formattedErrors,
          },
          'URL parameter validation failed'
        );

        return res.status(400).json({
          error: 'Invalid URL parameters',
          details: formattedErrors,
        });
      }

      next(error);
    }
  };
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  /** UUID parameter */
  uuid: z.string().uuid(),

  /** Pagination query */
  pagination: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).optional(),
  }),

  /** Search query */
  search: z.object({
    q: z.string().min(1).max(200),
    ...z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(20),
    }).shape,
  }),

  /** Sort and filter */
  sortFilter: z.object({
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
    filter: z.record(z.string()).optional(),
  }),

  /** Email */
  email: z.string().email().toLowerCase(),

  /** Phone number (E.164 format) */
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Invalid phone number format'),

  /** URL */
  url: z.string().url(),

  /** Date range */
  dateRange: z.object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  }).refine(
    (data) => data.endDate >= data.startDate,
    'End date must be after start date'
  ),

  /** ID parameter */
  idParam: z.object({
    id: z.string().uuid(),
  }),

  /** Webhook payload with signature */
  webhookPayload: z.object({
    signature: z.string(),
    timestamp: z.coerce.number(),
    payload: z.record(z.any()),
  }),
};

/**
 * Sanitize string input (prevent XSS)
 */
export function sanitizeString(str: string): string {
  return str
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized: any = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === 'object' && item !== null ? sanitizeObject(item) : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Middleware to sanitize all string inputs
 */
export function sanitizeInputs() {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query as any);
    }

    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }

    next();
  };
}
