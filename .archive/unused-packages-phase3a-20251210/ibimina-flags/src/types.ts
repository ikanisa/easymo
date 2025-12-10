export type FlagScope = "global" | "country" | "partner";

export interface FlagRecord {
  readonly id: string;
  readonly key: string;
  readonly enabled: boolean;
  readonly scope: FlagScope;
  readonly targetId: string | null;
  readonly updatedAt: string | null;
  readonly updatedBy: string | null;
}

export interface FlagDefinitionSummary {
  readonly key: string;
  readonly description?: string;
  readonly defaultValue?: boolean;
  readonly rollout?: string;
}

export interface FlagMatrixEntry {
  readonly key: string;
  readonly definition: FlagDefinitionSummary;
  global: FlagRecord | null;
  countries: Record<string, FlagRecord>;
  partners: Record<string, FlagRecord>;
}

export interface FlagMetadata {
  readonly countries: Array<{ id: string; name: string; iso3?: string | null }>;
  readonly partners: Array<{ id: string; name: string; countryId: string | null }>;
}

export interface FlagAdminSnapshot {
  readonly flags: FlagMatrixEntry[];
  readonly metadata: FlagMetadata;
}

export interface FlagChange {
  readonly key: string;
  readonly scope: FlagScope;
  readonly targetId?: string | null;
  readonly value: boolean | null;
  readonly actorId?: string | null;
}

export type FeatureFlagKey = string;

export interface FeatureFlagContext {
  readonly countryId?: string | null;
  readonly orgId?: string | null;
}

export interface FeatureFlagEntry {
  readonly key: FeatureFlagKey;
  readonly enabled: boolean;
}

export type FeatureFlagMap = Record<FeatureFlagKey, FeatureFlagEntry>;
