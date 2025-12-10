import { ussdConfigData } from "./data/ussdConfig";
import { z } from "zod";

const UssdLocaleSchema = z.object({
  copy: z.string(),
  cta: z.string(),
  instructions: z.array(z.string()).min(1),
});

const UssdTemplateSchema = z.object({
  shortcut: z.string(),
  menu: z.string(),
  base: z.string(),
});

const PlaceholderSchema = z.object({
  merchant: z.string(),
  amount: z.string(),
  reference: z.string(),
});

const OperatorSchema = z.object({
  id: z.string(),
  name: z.string(),
  network: z.string(),
  country: z.string().length(2),
  currency: z.string().length(3),
  supportsAutoDial: z.boolean(),
  default: z.boolean(),
  shortcode: z.string(),
  templates: UssdTemplateSchema,
  placeholders: PlaceholderSchema,
  locales: z.record(z.string(), UssdLocaleSchema).refine((val) => Object.keys(val).length > 0, {
    message: "At least one locale definition is required",
  }),
});

const UssdConfigSchema = z.object({
  version: z.string(),
  ttlSeconds: z.number().int().positive(),
  operators: z.array(OperatorSchema).min(1),
});

export const ussdConfig = UssdConfigSchema.parse(ussdConfigData);

export type UssdConfig = typeof ussdConfig;
export type UssdOperatorConfig = z.infer<typeof OperatorSchema>;
export type UssdLocaleDefinition = z.infer<typeof UssdLocaleSchema>;

export function getUssdOperatorById(id: string): UssdOperatorConfig | undefined {
  return ussdConfig.operators.find((operator) => operator.id === id);
}

export function getDefaultUssdOperator(): UssdOperatorConfig {
  const preferred = ussdConfig.operators.find((operator) => operator.default);
  return preferred ?? ussdConfig.operators[0];
}
