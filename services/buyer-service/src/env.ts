import { validateEnv } from "@easymo/commons";
import { z } from "zod";

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test", "staging"]).default("development"),
    PORT: z.coerce.number().default(4700),
    LOG_LEVEL: z.string().default("info"),
    DATABASE_URL: z.string().min(1),
    EASYMO_ADMIN_API_BASE: z.string().url().optional(),
    EASYMO_ADMIN_TOKEN: z.string().min(10).optional(),
    EASYMO_ADMIN_ACTOR_ID: z.string().uuid().optional(),
    ADMIN_TEST_ACTOR_ID: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "production") {
      if (!value.EASYMO_ADMIN_API_BASE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "EASYMO_ADMIN_API_BASE is required in production",
          path: ["EASYMO_ADMIN_API_BASE"],
        });
      }
      if (!value.EASYMO_ADMIN_TOKEN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "EASYMO_ADMIN_TOKEN is required in production",
          path: ["EASYMO_ADMIN_TOKEN"],
        });
      }
    }
  });

export const env = validateEnv(schema, {
  exitOnError: process.env.NODE_ENV === "production",
});
