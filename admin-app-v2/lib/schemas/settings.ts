import { z } from 'zod';

export const settingsSchema = z.object({
  siteName: z.string().min(1, 'Site name is required'),
  supportEmail: z.string().email('Invalid email address'),
  maxUploadSize: z.string().regex(/^\d+$/, 'Must be a number'),
  maintenanceMode: z.boolean(),
});

export type SettingsFormData = z.infer<typeof settingsSchema>;

export const tokenAllocationSchema = z.object({
  recipientType: z.enum(['partner', 'user']),
  recipient: z.string().min(1, 'Recipient is required'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount format'),
});

export type TokenAllocationFormData = z.infer<typeof tokenAllocationSchema>;
