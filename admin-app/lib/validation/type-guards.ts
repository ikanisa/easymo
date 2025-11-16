/**
 * Type Guards and Validators
 * 
 * Reusable type validation utilities to reduce 'any' usage
 * and improve runtime type safety across the application.
 */

// ============================================================================
// Basic Type Guards
// ============================================================================

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

// ============================================================================
// API Response Guards
// ============================================================================

export interface ApiErrorResponse {
  error: string;
  message?: string;
  details?: unknown;
}

export function isApiError(value: unknown): value is ApiErrorResponse {
  return isObject(value) && "error" in value && isString(value.error);
}

export interface ApiSuccessResponse<T = unknown> {
  data: T;
  message?: string;
}

export function isApiSuccess<T = unknown>(
  value: unknown
): value is ApiSuccessResponse<T> {
  return isObject(value) && "data" in value;
}

// ============================================================================
// Supabase Response Guards
// ============================================================================

export interface SupabaseError {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

export function isSupabaseError(value: unknown): value is SupabaseError {
  return isObject(value) && "message" in value && isString(value.message);
}

// ============================================================================
// Database Record Guards
// ============================================================================

export interface DatabaseRecord {
  id: string;
  created_at: string;
  updated_at?: string;
}

export function isDatabaseRecord(value: unknown): value is DatabaseRecord {
  return (
    isObject(value) &&
    "id" in value &&
    isString(value.id) &&
    "created_at" in value &&
    isString(value.created_at)
  );
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates and extracts a string from unknown input
 * @throws {TypeError} if value is not a string
 */
export function requireString(value: unknown, name = "value"): string {
  if (!isString(value)) {
    throw new TypeError(`Expected ${name} to be string, got ${typeof value}`);
  }
  return value;
}

/**
 * Validates and extracts a number from unknown input
 * @throws {TypeError} if value is not a number
 */
export function requireNumber(value: unknown, name = "value"): number {
  if (!isNumber(value)) {
    throw new TypeError(`Expected ${name} to be number, got ${typeof value}`);
  }
  return value;
}

/**
 * Validates and extracts an object from unknown input
 * @throws {TypeError} if value is not an object
 */
export function requireObject(
  value: unknown,
  name = "value"
): Record<string, unknown> {
  if (!isObject(value)) {
    throw new TypeError(`Expected ${name} to be object, got ${typeof value}`);
  }
  return value;
}

/**
 * Validates and extracts an array from unknown input
 * @throws {TypeError} if value is not an array
 */
export function requireArray(value: unknown, name = "value"): unknown[] {
  if (!isArray(value)) {
    throw new TypeError(`Expected ${name} to be array, got ${typeof value}`);
  }
  return value;
}

// ============================================================================
// Safe Accessors
// ============================================================================

/**
 * Safely access a property on an object
 * Returns undefined if property doesn't exist or isn't the expected type
 */
export function getString(
  obj: unknown,
  key: string,
  fallback?: string
): string | undefined {
  if (!isObject(obj)) return fallback;
  const value = obj[key];
  return isString(value) ? value : fallback;
}

export function getNumber(
  obj: unknown,
  key: string,
  fallback?: number
): number | undefined {
  if (!isObject(obj)) return fallback;
  const value = obj[key];
  return isNumber(value) ? value : fallback;
}

export function getBoolean(
  obj: unknown,
  key: string,
  fallback?: boolean
): boolean | undefined {
  if (!isObject(obj)) return fallback;
  const value = obj[key];
  return isBoolean(value) ? value : fallback;
}

export function getObject(
  obj: unknown,
  key: string
): Record<string, unknown> | undefined {
  if (!isObject(obj)) return undefined;
  const value = obj[key];
  return isObject(value) ? value : undefined;
}

export function getArray(obj: unknown, key: string): unknown[] | undefined {
  if (!isObject(obj)) return undefined;
  const value = obj[key];
  return isArray(value) ? value : undefined;
}
