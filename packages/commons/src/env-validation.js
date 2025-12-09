import { z } from 'zod';
import { childLogger } from './logger';
const log = childLogger({ service: 'env-validation' });
/**
 * Environment validation error
 */
export class EnvValidationError extends Error {
    issues;
    constructor(issues, message) {
        super(message || 'Environment validation failed');
        this.issues = issues;
        this.name = 'EnvValidationError';
    }
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
export function validateEnv(schema, options) {
    const logger = options?.logger || log;
    const exitOnError = options?.exitOnError ?? process.env.NODE_ENV === 'production';
    try {
        const parsed = schema.parse(process.env);
        logger.info({
            validatedKeys: Object.keys(parsed),
            environment: process.env.NODE_ENV || 'unknown',
        }, 'Environment validation passed');
        return parsed;
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            const issues = error.issues.map((issue) => ({
                path: issue.path.join('.'),
                message: issue.message,
                code: issue.code,
            }));
            logger.error({ issues, environment: process.env.NODE_ENV }, 'Environment validation failed');
            const validationError = new EnvValidationError(error.issues);
            if (exitOnError) {
                console.error('\n❌ ENVIRONMENT VALIDATION FAILED\n');
                console.error('Missing or invalid environment variables:\n');
                issues.forEach(({ path, message }) => {
                    console.error(`  - ${path}: ${message}`);
                });
                console.error('\nPlease check your .env file and environment configuration.\n');
                process.exit(1);
            }
            throw validationError;
        }
        throw error;
    }
}
/**
 * Common environment variable schemas
 */
export const commonEnvSchemas = {
    /** Port number with default */
    port: (defaultPort = 3000) => z.coerce.number().min(1).max(65535).default(defaultPort),
    /** Node environment */
    nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
    /** Database URL (PostgreSQL) */
    databaseUrl: z.string().url().startsWith('postgresql://'),
    /** Redis URL */
    redisUrl: z.string().url().startsWith('redis://').optional(),
    /** JWT secret (minimum 32 characters) */
    jwtSecret: z.string().min(32),
    /** API key (minimum 16 characters) */
    apiKey: z.string().min(16),
    /** Supabase URL */
    supabaseUrl: z.string().url().startsWith('https://'),
    /** Supabase anonymous key */
    supabaseAnonKey: z.string().min(20),
    /** Supabase service role key (should not be in client env) */
    supabaseServiceRoleKey: z.string().min(20),
    /** Boolean flag */
    booleanFlag: (defaultValue = false) => z
        .string()
        .optional()
        .transform((val) => val === 'true' || val === '1')
        .default(String(defaultValue)),
    /** Kafka brokers */
    kafkaBrokers: z
        .string()
        .transform((val) => val.split(',').map((s) => s.trim()))
        .refine((arr) => arr.length > 0, 'At least one Kafka broker required'),
    /** Log level */
    logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    /** CORS origins */
    corsOrigins: z
        .string()
        .transform((val) => val.split(',').map((s) => s.trim()))
        .default('*'),
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
export function createServiceEnvSchema(serviceName, customSchema, options) {
    const baseSchema = {
        NODE_ENV: commonEnvSchemas.nodeEnv,
        PORT: commonEnvSchemas.port(options?.defaultPort),
        LOG_LEVEL: commonEnvSchemas.logLevel,
    };
    if (options?.includeRedis) {
        baseSchema.REDIS_URL = commonEnvSchemas.redisUrl;
    }
    if (options?.includeKafka) {
        baseSchema.KAFKA_BROKERS = commonEnvSchemas.kafkaBrokers;
    }
    return z.object({
        ...baseSchema,
        ...customSchema,
    });
}
/**
 * Mask sensitive environment variables for logging
 */
export function maskSensitiveEnv(env) {
    const sensitiveKeys = [
        'PASSWORD',
        'SECRET',
        'KEY',
        'TOKEN',
        'API_KEY',
        'PRIVATE',
        'CREDENTIALS',
        'AUTH',
    ];
    const masked = {};
    for (const [key, value] of Object.entries(env)) {
        const isSensitive = sensitiveKeys.some((sensitive) => key.toUpperCase().includes(sensitive));
        if (isSensitive && typeof value === 'string') {
            masked[key] = value.length > 8 ? `${value.slice(0, 4)}...${value.slice(-4)}` : '***';
        }
        else {
            masked[key] = String(value);
        }
    }
    return masked;
}
