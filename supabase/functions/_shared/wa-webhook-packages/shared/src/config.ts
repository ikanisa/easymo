// Configuration utilities

export function getRequiredEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

export function getOptionalEnv(key: string, defaultValue: string): string {
  return Deno.env.get(key) ?? defaultValue;
}

export const config = {
  supabaseUrl: getRequiredEnv("SUPABASE_URL"),
  supabaseServiceKey: getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  waPhoneId: getRequiredEnv("WA_PHONE_ID"),
  waToken: getRequiredEnv("WA_TOKEN"),
  waVerifyToken: getRequiredEnv("WA_VERIFY_TOKEN"),
  environment: getOptionalEnv("ENVIRONMENT", "production"),
};
