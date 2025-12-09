export const requiredEnvConfig = Object.freeze({
  required: Object.freeze([
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENAI_API_KEY",
  ] as const),
  atLeastOne: Object.freeze([] as const),
} as const);

export type RequiredEnvConfig = typeof requiredEnvConfig;
