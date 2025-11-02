import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export const SupabaseConfigurationSchema = z.object({
  url: z.string().url(),
  key: z.string().min(1, "Supabase service key is required"),
  schema: z.string().default("public"),
});

export type SupabaseConfiguration = z.infer<typeof SupabaseConfigurationSchema>;

export interface RequestContext {
  requestId: string;
}

export interface InstrumentationHooks {
  onStart?: (context: RequestContext, operation: string) => void;
  onSuccess?: (context: RequestContext, operation: string, durationMs: number) => void;
  onError?: (
    context: RequestContext,
    operation: string,
    durationMs: number,
    error: unknown
  ) => void;
}

export interface SupabaseClientWrapper<Database> {
  readonly client: SupabaseClient<Database>;
  withInstrumentation<T>(
    context: RequestContext,
    operation: string,
    callback: (client: SupabaseClient<Database>) => Promise<T>
  ): Promise<T>;
}

export const createSupabaseClientWrapper = <Database>(
  rawConfig: SupabaseConfiguration,
  hooks: InstrumentationHooks = {}
): SupabaseClientWrapper<Database> => {
  const config = SupabaseConfigurationSchema.parse(rawConfig);
  const client = createClient<Database>(config.url, config.key, {
    db: { schema: config.schema },
    auth: { persistSession: false },
  });

  return {
    client,
    async withInstrumentation(context, operation, callback) {
      const start = Date.now();
      hooks.onStart?.(context, operation);
      try {
        const result = await callback(client);
        hooks.onSuccess?.(context, operation, Date.now() - start);
        return result;
      } catch (error) {
        hooks.onError?.(context, operation, Date.now() - start, error);
        throw error;
      }
    },
  };
};
