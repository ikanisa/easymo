/**
 * Member management operations for SACCO admin
 */

import { FEATURE_FLAGS, isFeatureEnabled } from '@easymo/flags';
import { 
  type CreateMember, 
  CreateMemberSchema,
  type Member, 
  MemberSchema,
  type UpdateMember,
} from '@easymo/sacco-core';

export { type CreateMember, type Member, type UpdateMember };

/**
 * Member service interface
 * Placeholder - will be fully implemented during Ibimina merger
 */
export interface MemberService {
  /**
   * Get a member by ID
   */
  getMember(id: string): Promise<Member | null>;
  
  /**
   * List members for an ikimina group
   */
  listMembers(ikiminaId: string, options?: ListMembersOptions): Promise<MemberListResult>;
  
  /**
   * Create a new member
   */
  createMember(data: CreateMember): Promise<Member>;
  
  /**
   * Update a member
   */
  updateMember(id: string, data: UpdateMember): Promise<Member>;
  
  /**
   * Soft delete a member (set status to INACTIVE)
   */
  deleteMember(id: string): Promise<void>;
  
  /**
   * Import members from CSV/Excel
   */
  importMembers(ikiminaId: string, data: CreateMember[]): Promise<ImportResult>;
}

export interface ListMembersOptions {
  page?: number;
  limit?: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  search?: string;
}

export interface MemberListResult {
  members: Member[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ImportResult {
  imported: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * Validate member data
 */
export function validateMember(data: unknown): { success: true; data: Member } | { success: false; errors: string[] } {
  const result = MemberSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { 
    success: false, 
    errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
  };
}

/**
 * Validate create member data
 */
export function validateCreateMember(data: unknown): { success: true; data: CreateMember } | { success: false; errors: string[] } {
  const result = CreateMemberSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { 
    success: false, 
    errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
  };
}

/**
 * Check if member management features are enabled
 */
export function isMemberManagementEnabled(): boolean {
  return isFeatureEnabled(FEATURE_FLAGS.VENDOR_PORTAL) && 
         isFeatureEnabled(FEATURE_FLAGS.IKIMINA_MANAGEMENT);
}
