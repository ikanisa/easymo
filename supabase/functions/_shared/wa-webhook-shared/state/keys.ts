/**
 * State Key Constants
 * 
 * Centralized state keys to avoid magic strings throughout the codebase.
 * Organized by webhook/domain.
 */

export const STATE_KEYS = {
  // Mobility webhook states
  MOBILITY: {
    NEARBY_SELECT: 'mobility_nearby_select',
    NEARBY_RESULTS: 'mobility_nearby_results',
    NEARBY_LOCATION: 'mobility_nearby_location',
    GO_ONLINE: 'go_online_prompt',
    GO_ONLINE_LOCATION: 'go_online_location',
    TRIP_IN_PROGRESS: 'trip_in_progress',
    SCHEDULE_ROLE: 'schedule_role',
    SCHEDULE_LOCATION: 'schedule_location',
    SCHEDULE_VEHICLE: 'schedule_vehicle',
    SCHEDULE_DROPOFF: 'schedule_dropoff',
    SCHEDULE_TIME: 'schedule_time',
    SCHEDULE_RECURRENCE: 'schedule_recurrence',
    LOCATION_SAVED_PICKER: 'location_saved_picker',
  },
  
  // Profile webhook states
  PROFILE: {
    EDIT_NAME: 'EDIT_PROFILE_NAME',
    EDIT_LANGUAGE: 'EDIT_PROFILE_LANGUAGE',
    ADD_LOCATION: 'add_location',
    CONFIRM_ADD_LOCATION: 'confirm_add_location',
    BUSINESS_DETAIL: 'business_detail',
    EDIT_BUSINESS: 'edit_business',
    CREATE_BUSINESS: 'create_business',
  },
  
  // Insurance webhook states
  INSURANCE: {
    UPLOAD: 'insurance_upload',
    CLAIM_DESCRIPTION: 'claim_description',
    CLAIM_TYPE: 'claim_type',
    CLAIM_DOCUMENTS: 'claim_documents',
    MOTOR_UPLOAD: 'motor_insurance_upload',
  },
  
  // Wallet states
  WALLET: {
    CASHOUT: 'wallet_cashout',
    CASHOUT_AMOUNT: 'wallet_cashout_amount',
    CASHOUT_CONFIRM: 'wallet_cashout_confirm',
    PURCHASE: 'wallet_purchase',
  },
  
  // Payment states
  PAYMENT: {
    PENDING: 'payment_pending',
    AWAITING_REFERENCE: 'payment_awaiting_reference',
    CONFIRMED: 'payment_confirmed',
  },
  
  // Verification states
  VERIFICATION: {
    LICENSE_UPLOAD: 'license_upload',
    INSURANCE_UPLOAD: 'driver_insurance_upload',
    VEHICLE_UPLOAD: 'vehicle_upload',
  },
} as const;

// Type helpers for type safety
export type MobilityStateKey = typeof STATE_KEYS.MOBILITY[keyof typeof STATE_KEYS.MOBILITY];
export type ProfileStateKey = typeof STATE_KEYS.PROFILE[keyof typeof STATE_KEYS.PROFILE];
export type InsuranceStateKey = typeof STATE_KEYS.INSURANCE[keyof typeof STATE_KEYS.INSURANCE];
export type WalletStateKey = typeof STATE_KEYS.WALLET[keyof typeof STATE_KEYS.WALLET];
export type PaymentStateKey = typeof STATE_KEYS.PAYMENT[keyof typeof STATE_KEYS.PAYMENT];
export type VerificationStateKey = typeof STATE_KEYS.VERIFICATION[keyof typeof STATE_KEYS.VERIFICATION];

export type AnyStateKey = 
  | MobilityStateKey 
  | ProfileStateKey 
  | InsuranceStateKey 
  | WalletStateKey
  | PaymentStateKey
  | VerificationStateKey;

/**
 * Check if a state key belongs to a specific domain
 */
export function isMobilityState(key: string): key is MobilityStateKey {
  return Object.values(STATE_KEYS.MOBILITY).includes(key as any);
}

export function isProfileState(key: string): key is ProfileStateKey {
  return Object.values(STATE_KEYS.PROFILE).includes(key as any);
}

export function isInsuranceState(key: string): key is InsuranceStateKey {
  return Object.values(STATE_KEYS.INSURANCE).includes(key as any);
}

export function isWalletState(key: string): key is WalletStateKey {
  return Object.values(STATE_KEYS.WALLET).includes(key as any);
}

export function isPaymentState(key: string): key is PaymentStateKey {
  return Object.values(STATE_KEYS.PAYMENT).includes(key as any);
}

export function isVerificationState(key: string): key is VerificationStateKey {
  return Object.values(STATE_KEYS.VERIFICATION).includes(key as any);
}
