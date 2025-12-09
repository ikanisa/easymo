import { z } from 'zod';
declare const log: import("pino").Logger<never, boolean>;
/**
 * Environment validation error
 */
export declare class EnvValidationError extends Error {
    readonly issues: z.ZodIssue[];
    constructor(issues: z.ZodIssue[], message?: string);
}
/**
 * Validate environment variables on startup
 *
 * @example
 * ```typescript
 * import { validateEnv } from '@easymo/commons';
 * import { z } from 'zod';
 *
 * const envSchema = z.object({
 *   PORT: z.coerce.number().default(3000),
 *   DATABASE_URL: z.string().url(),
 *   REDIS_URL: z.string().url().optional(),
 *   NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
 * });
 *
 * const env = validateEnv(envSchema);
 * ```
 */
export declare function validateEnv<T extends z.ZodRawShape>(schema: z.ZodObject<T>, options?: {
    /** Exit process on validation failure (default: true in production) */
    exitOnError?: boolean;
    /** Custom logger */
    logger?: typeof log;
}): z.infer<z.ZodObject<T>>;
/**
 * Common environment variable schemas
 */
export declare const commonEnvSchemas: {
    /** Port number with default */
    port: (defaultPort?: number) => z.ZodDefault<z.ZodNumber>;
    /** Node environment */
    nodeEnv: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
    /** Database URL (PostgreSQL) */
    databaseUrl: z.ZodString;
    /** Redis URL */
    redisUrl: z.ZodOptional<z.ZodString>;
    /** JWT secret (minimum 32 characters) */
    jwtSecret: z.ZodString;
    /** API key (minimum 16 characters) */
    apiKey: z.ZodString;
    /** Supabase URL */
    supabaseUrl: z.ZodString;
    /** Supabase anonymous key */
    supabaseAnonKey: z.ZodString;
    /** Supabase service role key (should not be in client env) */
    supabaseServiceRoleKey: z.ZodString;
    /** Boolean flag */
    booleanFlag: (defaultValue?: boolean) => z.ZodDefault<z.ZodEffects<z.ZodOptional<z.ZodString>, boolean, string | undefined>>;
    /** Kafka brokers */
    kafkaBrokers: z.ZodEffects<z.ZodEffects<z.ZodString, string[], string>, string[], string>;
    /** Log level */
    logLevel: z.ZodDefault<z.ZodEnum<["trace", "debug", "info", "warn", "error", "fatal"]>>;
    /** CORS origins */
    corsOrigins: z.ZodDefault<z.ZodEffects<z.ZodString, string[], string>>;
};
/**
 * Create a base environment schema for a service
 *
 * @example
 * ```typescript
 * const schema = createServiceEnvSchema('attribution-service', {
 *   DATABASE_URL: commonEnvSchemas.databaseUrl,
 *   CUSTOM_API_KEY: z.string(),
 * });
 *
 * const env = validateEnv(schema);
 * ```
 */
export declare function createServiceEnvSchema<T extends z.ZodRawShape>(serviceName: string, customSchema: T, options?: {
    includeRedis?: boolean;
    includeKafka?: boolean;
    defaultPort?: number;
}): z.ZodObject<T & z.ZodRawShape>;
/**
 * Mask sensitive environment variables for logging
 */
export declare function maskSensitiveEnv(env: Record<string, any>): Record<string, string>;
export {};
//# sourceMappingURL=env-validation.d.ts.map