import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════
// Member Validation Schemas
// Description: Zod schemas for member input validation
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Rwanda-specific Validators
// ─────────────────────────────────────────────────────────────────────────────

// Rwanda phone number: 07X XXX XXXX or +250 7X XXX XXXX
const rwandaPhoneRegex = /^(\+?250)?0?7[2389]\d{7}$/;

// Rwanda National ID: 16 digits starting with 1 or 2
const rwandaNIDRegex = /^[12]\d{15}$/;

// ─────────────────────────────────────────────────────────────────────────────
// Address Schema
// ─────────────────────────────────────────────────────────────────────────────

export const memberAddressSchema = z.object({
  province: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  sector: z.string().max(100).optional(),
  cell: z.string().max(100).optional(),
  village: z.string().max(100).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Create Member Schema
// ─────────────────────────────────────────────────────────────────────────────

export const createMemberSchema = z.object({
  sacco_id: z.string().uuid("Invalid SACCO ID"),
  ikimina_id: z.string().uuid("Invalid group ID"),
  full_name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .regex(/^[a-zA-Z\s'-]+$/, "Name contains invalid characters"),
  phone: z
    .string()
    .regex(rwandaPhoneRegex, "Invalid Rwanda phone number (use format: 078XXXXXXX)"),
  national_id: z
    .string()
    .regex(rwandaNIDRegex, "Invalid National ID (must be 16 digits)")
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
  gender: z.enum(["male", "female", "other"], {
    errorMap: () => ({ message: "Gender must be male, female, or other" }),
  }).optional(),
  date_of_birth: z
    .string()
    .refine((val) => {
      if (!val) return true;
      const date = new Date(val);
      const now = new Date();
      const age = now.getFullYear() - date.getFullYear();
      return age >= 18 && age <= 120;
    }, "Member must be at least 18 years old")
    .optional()
    .or(z.literal("")),
  address: memberAddressSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Update Member Schema
// ─────────────────────────────────────────────────────────────────────────────

export const updateMemberSchema = z.object({
  full_name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .regex(/^[a-zA-Z\s'-]+$/, "Name contains invalid characters")
    .optional(),
  phone: z
    .string()
    .regex(rwandaPhoneRegex, "Invalid Rwanda phone number")
    .optional(),
  national_id: z
    .string()
    .regex(rwandaNIDRegex, "Invalid National ID (must be 16 digits)")
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
  gender: z.enum(["male", "female", "other"]).optional(),
  date_of_birth: z
    .string()
    .refine((val) => {
      if (!val) return true;
      const date = new Date(val);
      const now = new Date();
      const age = now.getFullYear() - date.getFullYear();
      return age >= 18 && age <= 120;
    }, "Member must be at least 18 years old")
    .optional()
    .or(z.literal("")),
  address: memberAddressSchema.optional(),
  ikimina_id: z.string().uuid("Invalid group ID").optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"], {
    errorMap: () => ({ message: "Status must be ACTIVE, INACTIVE, or SUSPENDED" }),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Import Schema
// ─────────────────────────────────────────────────────────────────────────────

export const bulkImportMemberSchema = z.object({
  full_name: z.string().min(2).max(100),
  phone: z.string().regex(rwandaPhoneRegex),
  ikimina_id: z.string().uuid().optional(),
  national_id: z.string().regex(rwandaNIDRegex).optional(),
  email: z.string().email().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  date_of_birth: z.string().optional(),
  address: memberAddressSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const bulkImportSchema = z.object({
  sacco_id: z.string().uuid("Invalid SACCO ID"),
  members: z
    .array(bulkImportMemberSchema)
    .min(1, "At least one member is required")
    .max(500, "Maximum 500 members per import"),
});

// ─────────────────────────────────────────────────────────────────────────────
// Search Schema
// ─────────────────────────────────────────────────────────────────────────────

export const searchMemberSchema = z.object({
  sacco_id: z.string().uuid(),
  query: z.string().min(1, "Search query is required").max(100),
  limit: z.coerce.number().min(1).max(50).optional().default(20),
});

// ─────────────────────────────────────────────────────────────────────────────
// Transfer Schema
// ─────────────────────────────────────────────────────────────────────────────

export const transferMemberSchema = z.object({
  member_id: z.string().uuid("Invalid member ID"),
  new_ikimina_id: z.string().uuid("Invalid group ID"),
  transfer_balance: z.boolean().optional().default(true),
});

// ─────────────────────────────────────────────────────────────────────────────
// Deactivate Schema
// ─────────────────────────────────────────────────────────────────────────────

export const deactivateMemberSchema = z.object({
  member_id: z.string().uuid("Invalid member ID"),
  reason: z.string().max(500, "Reason must be less than 500 characters").optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Query Parameters Schema (for GET /api/members)
// ─────────────────────────────────────────────────────────────────────────────

export const memberListQuerySchema = z.object({
  sacco_id: z.string().uuid(),
  search: z.string().optional(),
  ikimina_id: z.string().uuid().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "all"]).optional().default("ACTIVE"),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
  sort_by: z.enum(["full_name", "created_at", "joined_at", "member_code"]).optional().default("full_name"),
  sort_order: z.enum(["asc", "desc"]).optional().default("asc"),
});

// ─────────────────────────────────────────────────────────────────────────────
// Export Inferred Types
// ─────────────────────────────────────────────────────────────────────────────

export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type BulkImportInput = z.infer<typeof bulkImportSchema>;
export type BulkImportMemberInput = z.infer<typeof bulkImportMemberSchema>;
export type SearchMemberInput = z.infer<typeof searchMemberSchema>;
export type TransferMemberInput = z.infer<typeof transferMemberSchema>;
export type DeactivateMemberInput = z.infer<typeof deactivateMemberSchema>;
export type MemberListQuery = z.infer<typeof memberListQuerySchema>;
