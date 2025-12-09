/**
 * Payment reconciliation operations for SACCO
 */

import { 
  type Payment, 
  PaymentSchema,
} from '@easymo/sacco-core';
import { isFeatureEnabled, FEATURE_FLAGS } from '@easymo/flags';

export { type Payment };

/**
 * Reconciliation service interface
 * Placeholder - will be fully implemented during Ibimina merger
 */
export interface ReconciliationService {
  /**
   * Get pending payments for reconciliation
   */
  getPendingPayments(ikiminaId: string, options?: ReconciliationOptions): Promise<PaymentListResult>;
  
  /**
   * Match a payment with a member contribution
   */
  matchPayment(paymentId: string, memberId: string, metadata?: Record<string, unknown>): Promise<Payment>;
  
  /**
   * Reject a payment (mark as failed)
   */
  rejectPayment(paymentId: string, reason: string): Promise<Payment>;
  
  /**
   * Auto-reconcile payments based on SMS parsing confidence
   */
  autoReconcile(ikiminaId: string, confidenceThreshold?: number): Promise<AutoReconcileResult>;
  
  /**
   * Get reconciliation statistics
   */
  getReconciliationStats(ikiminaId: string, dateRange?: DateRange): Promise<ReconciliationStats>;
}

export interface ReconciliationOptions {
  page?: number;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export interface PaymentListResult {
  payments: Payment[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface AutoReconcileResult {
  matched: number;
  unmatched: number;
  errors: Array<{ paymentId: string; error: string }>;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ReconciliationStats {
  totalPayments: number;
  reconciled: number;
  pending: number;
  failed: number;
  totalAmount: number;
  reconciledAmount: number;
  pendingAmount: number;
  currency: string;
}

/**
 * Payment status labels
 */
export const PAYMENT_STATUS_LABELS = {
  pending: 'Pending',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
} as const;

/**
 * Validate payment data
 */
export function validatePayment(data: unknown): { success: true; data: Payment } | { success: false; errors: string[] } {
  const result = PaymentSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { 
    success: false, 
    errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
  };
}

/**
 * Check if reconciliation features are enabled
 */
export function isReconciliationEnabled(): boolean {
  return isFeatureEnabled(FEATURE_FLAGS.SACCO_RECONCILIATION);
}

/**
 * Calculate match confidence between SMS data and member
 */
export function calculateMatchConfidence(
  smsData: { phone?: string; name?: string; amount?: number },
  memberData: { msisdn: string; full_name: string }
): number {
  let confidence = 0;
  
  // Phone number match (highest weight)
  if (smsData.phone && memberData.msisdn) {
    const normalizedSms = smsData.phone.replace(/\D/g, '').slice(-9);
    const normalizedMember = memberData.msisdn.replace(/\D/g, '').slice(-9);
    if (normalizedSms === normalizedMember) {
      confidence += 0.6;
    }
  }
  
  // Name similarity (fuzzy match)
  if (smsData.name && memberData.full_name) {
    const smsName = smsData.name.toLowerCase();
    const memberName = memberData.full_name.toLowerCase();
    if (memberName.includes(smsName) || smsName.includes(memberName)) {
      confidence += 0.4;
    } else {
      // Partial name match (first name or last name)
      const smsWords = smsName.split(/\s+/);
      const memberWords = memberName.split(/\s+/);
      const matches = smsWords.filter(w => memberWords.includes(w));
      confidence += (matches.length / Math.max(smsWords.length, memberWords.length)) * 0.3;
    }
  }
  
  return Math.min(confidence, 1);
}
