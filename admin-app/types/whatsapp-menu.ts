import { z } from "zod";

export const WhatsAppHomeMenuItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  key: z.string().min(1),
  is_active: z.boolean(),
  active_countries: z.array(z.string()),
  display_order: z.number().int().min(0),
  icon: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type WhatsAppHomeMenuItem = z.infer<typeof WhatsAppHomeMenuItemSchema>;

export const UpdateMenuItemSchema = z.object({
  name: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
  active_countries: z.array(z.string()).optional(),
  display_order: z.number().int().min(0).optional(),
  icon: z.string().nullable().optional(),
});

export type UpdateMenuItemInput = z.infer<typeof UpdateMenuItemSchema>;
