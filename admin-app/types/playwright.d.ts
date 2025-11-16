declare module "@playwright/test" {
  export const devices: Record<string, Record<string, unknown>>;
  export function defineConfig(config: Record<string, unknown>): Record<string, unknown>;
}

