// Source types (from Ibimina)
export interface SourceSacco {
  id: string;
  name: string;
  district: string;
  sector: string | null;
  sector_code: string;
  merchant_code: string | null;
  province: string | null;
  email: string | null;
  category: string | null;
  logo_url: string | null;
  brand_color: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SourceIkimina {
  id: string;
  sacco_id: string;
  code: string;
  name: string;
  type: string;
  settings_json: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SourceMember {
  id: string;
  ikimina_id: string | null;
  sacco_id: string;
  member_code: string | null;
  full_name: string;
  national_id: string | null;
  msisdn: string;
  joined_at: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SourceAccount {
  id: string;
  sacco_id: string | null;
  ikimina_id: string | null;
  member_id: string | null;
  account_type: string;
  balance: number;
  currency: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SourcePayment {
  id: string;
  sacco_id: string | null;
  ikimina_id: string | null;
  member_id: string | null;
  account_id: string | null;
  amount: number;
  currency: string;
  payment_method: string | null;
  reference: string | null;
  status: string;
  confidence: number | null;
  sms_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  processed_at: string | null;
}

export interface SourceLedgerEntry {
  id: string;
  sacco_id: string | null;
  debit_id: string | null;
  credit_id: string | null;
  amount: number;
  value_date: string;
  description: string | null;
  reference: string | null;
  created_at: string;
}

// Target types (for EasyMO - same structure but with PII handled)
export interface TargetMember {
  ikimina_id: string | null;
  sacco_id: string;
  member_code: string | null;
  full_name: string;
  national_id: null; // Never store plaintext
  national_id_encrypted: string | null;
  national_id_hash: string | null;
  national_id_masked: string | null;
  msisdn: null; // Never store plaintext
  msisdn_encrypted: string | null;
  msisdn_hash: string | null;
  msisdn_masked: string | null;
  joined_at: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// Migration result types
export interface MigrationResult {
  table: string;
  total: number;
  migrated: number;
  skipped: number;
  errors: Array<{ id: string; error: string }>;
  duration: number;
}

export interface MigrationSummary {
  startedAt: string;
  completedAt: string;
  dryRun: boolean;
  tables: Record<string, {
    total: number;
    migrated: number;
    skipped: number;
    errors: number;
    duration: number;
  }>;
  idMappings: Record<string, number>;
  totalDuration: number;
}
