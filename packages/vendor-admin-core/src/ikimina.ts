/**
 * Ikimina (savings groups) management operations
 */

import { 
  type Ikimina, 
  type CreateIkimina, 
  type UpdateIkimina,
  IkiminaSchema,
  CreateIkiminaSchema,
} from '@easymo/sacco-core';
import { isFeatureEnabled, FEATURE_FLAGS } from '@easymo/flags';

export { type Ikimina, type CreateIkimina, type UpdateIkimina };

/**
 * Ikimina service interface
 * Placeholder - will be fully implemented during Ibimina merger
 */
export interface IkiminaService {
  /**
   * Get an ikimina group by ID
   */
  getIkimina(id: string): Promise<Ikimina | null>;
  
  /**
   * List ikimina groups for a SACCO
   */
  listIkimina(saccoId: string, options?: ListIkiminaOptions): Promise<IkiminaListResult>;
  
  /**
   * Create a new ikimina group
   */
  createIkimina(data: CreateIkimina): Promise<Ikimina>;
  
  /**
   * Update an ikimina group
   */
  updateIkimina(id: string, data: UpdateIkimina): Promise<Ikimina>;
  
  /**
   * Suspend an ikimina group
   */
  suspendIkimina(id: string, reason: string): Promise<void>;
  
  /**
   * Reactivate a suspended ikimina group
   */
  reactivateIkimina(id: string): Promise<void>;
  
  /**
   * Get ikimina statistics
   */
  getIkiminaStats(id: string): Promise<IkiminaStats>;
}

export interface ListIkiminaOptions {
  page?: number;
  limit?: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  type?: 'ASCA' | 'VSLA' | 'SILC' | 'ROSCA';
  search?: string;
}

export interface IkiminaListResult {
  ikiminas: Ikimina[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface IkiminaStats {
  memberCount: number;
  totalContributions: number;
  totalLoans: number;
  outstandingLoans: number;
  savingsBalance: number;
  currency: string;
}

/**
 * Ikimina type descriptions
 */
export const IKIMINA_TYPES = {
  ASCA: {
    name: 'Accumulating Savings and Credit Association',
    description: 'Formal savings group with accumulated funds that grow over time',
  },
  VSLA: {
    name: 'Village Savings and Loan Association',
    description: 'Community-based savings and lending group',
  },
  SILC: {
    name: 'Savings and Internal Lending Community',
    description: 'Self-managed savings and lending group',
  },
  ROSCA: {
    name: 'Rotating Savings and Credit Association',
    description: 'Traditional rotating fund where members take turns receiving the pot',
  },
} as const;

/**
 * Validate ikimina data
 */
export function validateIkimina(data: unknown): { success: true; data: Ikimina } | { success: false; errors: string[] } {
  const result = IkiminaSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { 
    success: false, 
    errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
  };
}

/**
 * Validate create ikimina data
 */
export function validateCreateIkimina(data: unknown): { success: true; data: CreateIkimina } | { success: false; errors: string[] } {
  const result = CreateIkiminaSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { 
    success: false, 
    errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
  };
}

/**
 * Check if ikimina management features are enabled
 */
export function isIkiminaManagementEnabled(): boolean {
  return isFeatureEnabled(FEATURE_FLAGS.IKIMINA_MANAGEMENT);
}
