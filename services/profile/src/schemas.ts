import { z } from "zod";

/**
 * Profile validation schemas using Zod
 * Provides input validation with detailed error messages
 */

// E.164 phone number format validation
const phoneE164 = z.string()
  .regex(/^\+[1-9]\d{6,14}$/, "Phone number must be in E.164 format (e.g., +250781234567)")
  .optional();

// UUID validation
const uuid = z.string().uuid("Invalid UUID format");

// Create profile request schema
export const CreateProfileSchema = z.object({
  userId: uuid,
  whatsappE164: phoneE164,
  waId: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(255).optional(),
  email: z.string().email("Invalid email format").optional(),
  locale: z.string().min(2).max(10).default("en"),
  metadata: z.record(z.unknown()).optional(),
});

// Update profile request schema
export const UpdateProfileSchema = z.object({
  whatsappE164: phoneE164,
  waId: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(255).optional(),
  email: z.string().email("Invalid email format").optional(),
  locale: z.string().min(2).max(10).optional(),
  metadata: z.record(z.unknown()).optional(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  "At least one field must be provided for update"
);

// Get profile by ID params
export const GetProfileParamsSchema = z.object({
  id: uuid,
});

// Search profiles query params
export const SearchProfilesQuerySchema = z.object({
  phone: z.string().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// User saved location schema
export const SavedLocationSchema = z.object({
  label: z.string().min(1).max(50),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().max(500).optional(),
});

export const UpdateSavedLocationSchema = SavedLocationSchema.partial().refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  "At least one field must be provided for update"
);

// Type exports
export type CreateProfileInput = z.infer<typeof CreateProfileSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type SearchProfilesQuery = z.infer<typeof SearchProfilesQuerySchema>;
export type SavedLocationInput = z.infer<typeof SavedLocationSchema>;
