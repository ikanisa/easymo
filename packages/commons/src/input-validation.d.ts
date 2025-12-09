import { NextFunction, Request, Response } from 'express';
import { z, ZodSchema } from 'zod';
/**
 * Validation error response
 */
export declare class ValidationError extends Error {
    readonly errors: z.ZodIssue[];
    constructor(errors: z.ZodIssue[], message?: string);
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
export declare function validateBody<T extends ZodSchema>(schema: T): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
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
export declare function validateQuery<T extends ZodSchema>(schema: T): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
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
export declare function validateParams<T extends ZodSchema>(schema: T): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Common validation schemas
 */
export declare const commonSchemas: {
    /** UUID parameter */
    uuid: z.ZodString;
    /** Pagination query */
    pagination: z.ZodObject<{
        page: z.ZodDefault<z.ZodNumber>;
        limit: z.ZodDefault<z.ZodNumber>;
        offset: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        page: number;
        limit: number;
        offset?: number | undefined;
    }, {
        page?: number | undefined;
        limit?: number | undefined;
        offset?: number | undefined;
    }>;
    /** Search query */
    search: z.ZodObject<{
        page: z.ZodDefault<z.ZodNumber>;
        limit: z.ZodDefault<z.ZodNumber>;
        q: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        page: number;
        limit: number;
        q: string;
    }, {
        q: string;
        page?: number | undefined;
        limit?: number | undefined;
    }>;
    /** Sort and filter */
    sortFilter: z.ZodObject<{
        sortBy: z.ZodOptional<z.ZodString>;
        sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
        filter: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        sortOrder: "asc" | "desc";
        filter?: Record<string, string> | undefined;
        sortBy?: string | undefined;
    }, {
        filter?: Record<string, string> | undefined;
        sortBy?: string | undefined;
        sortOrder?: "asc" | "desc" | undefined;
    }>;
    /** Email */
    email: z.ZodString;
    /** Phone number (E.164 format) */
    phone: z.ZodString;
    /** URL */
    url: z.ZodString;
    /** Date range */
    dateRange: z.ZodEffects<z.ZodObject<{
        startDate: z.ZodDate;
        endDate: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        startDate: Date;
        endDate: Date;
    }, {
        startDate: Date;
        endDate: Date;
    }>, {
        startDate: Date;
        endDate: Date;
    }, {
        startDate: Date;
        endDate: Date;
    }>;
    /** ID parameter */
    idParam: z.ZodObject<{
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
    }, {
        id: string;
    }>;
    /** Webhook payload with signature */
    webhookPayload: z.ZodObject<{
        signature: z.ZodString;
        timestamp: z.ZodNumber;
        payload: z.ZodRecord<z.ZodString, z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        timestamp: number;
        signature: string;
        payload: Record<string, any>;
    }, {
        timestamp: number;
        signature: string;
        payload: Record<string, any>;
    }>;
};
/**
 * Sanitize string input (prevent XSS)
 */
export declare function sanitizeString(str: string): string;
/**
 * Sanitize object recursively
 */
export declare function sanitizeObject<T extends Record<string, any>>(obj: T): T;
/**
 * Middleware to sanitize all string inputs
 */
export declare function sanitizeInputs(): (req: Request, _res: Response, next: NextFunction) => void;
//# sourceMappingURL=input-validation.d.ts.map