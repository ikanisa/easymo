import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════
// Group Validation Schemas
// Description: Zod schemas for group (ikimina) input validation
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Create Group Schema
// ─────────────────────────────────────────────────────────────────────────────

export const createGroupSchema = z.object({
  sacco_id: z.string().uuid("Invalid SACCO ID"),
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
  type: z.enum(["ASCA", "ROSCA", "VSLA", "SACCO"], {
    required_error: "Group type is required",
    errorMap: () => ({ message: "Type must be ASCA, ROSCA, VSLA, or SACCO" }),
  }),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
  meeting_frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"], {
    required_error: "Meeting frequency is required",
    errorMap: () => ({ message: "Frequency must be WEEKLY, BIWEEKLY, or MONTHLY" }),
  }),
  meeting_day: z
    .number()
    .min(0, "Meeting day must be between 0 (Sunday) and 6 (Saturday)")
    .max(6, "Meeting day must be between 0 (Sunday) and 6 (Saturday)")
    .optional(),
  contribution_amount: z
    .number()
    .min(0, "Contribution amount cannot be negative")
    .optional(),
  currency: z.string().length(3, "Currency must be 3 characters (e.g., RWF)").optional().default("RWF"),
  start_date: z
    .string()
    .refine((val) => {
      if (!val) return true;
      const date = new Date(val);
      return !isNaN(date.getTime());
    }, "Invalid start date")
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Update Group Schema
// ─────────────────────────────────────────────────────────────────────────────

export const updateGroupSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .optional(),
  type: z.enum(["ASCA", "ROSCA", "VSLA", "SACCO"]).optional(),
  description: z.string().max(500).optional(),
  meeting_frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]).optional(),
  meeting_day: z.number().min(0).max(6).optional(),
  contribution_amount: z.number().min(0).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "DISSOLVED"], {
    errorMap: () => ({ message: "Status must be ACTIVE, INACTIVE, or DISSOLVED" }),
  }).optional(),
  end_date: z
    .string()
    .refine((val) => {
      if (!val) return true;
      const date = new Date(val);
      return !isNaN(date.getTime());
    }, "Invalid end date")
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Query Parameters Schema (for GET /api/groups)
// ─────────────────────────────────────────────────────────────────────────────

export const groupListQuerySchema = z.object({
  sacco_id: z.string().uuid(),
  search: z.string().optional(),
  type: z.enum(["ASCA", "ROSCA", "VSLA", "SACCO", "all"]).optional().default("all"),
  status: z.enum(["ACTIVE", "INACTIVE", "DISSOLVED", "all"]).optional().default("ACTIVE"),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
  sort_by: z.enum(["name", "created_at", "member_count"]).optional().default("name"),
  sort_order: z.enum(["asc", "desc"]).optional().default("asc"),
});

// ─────────────────────────────────────────────────────────────────────────────
// Export Inferred Types
// ─────────────────────────────────────────────────────────────────────────────

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export type GroupListQuery = z.infer<typeof groupListQuerySchema>;
