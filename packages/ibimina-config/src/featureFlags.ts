/*
 * Feature flag configuration for tenant-scoped rollouts.
 *
 * This module centralises pilot tenant metadata so that both backend scripts
 * and frontend clients can make consistent decisions about which experiences
 * should be enabled. All IDs are deterministic UUIDs so the seeding script and
 * feature gates stay in sync across environments.
 */

export type FeatureFlagName =
  | "directory"
  | "ticketing"
  | "nfcReferenceCards"
  | "memberVouchers"
  | "memberLoans"
  | "pwaFallback"
  | "commandPalette"
  | "atlasAssistant"
  | "offlineBanner"
  | "migratedWorkflows";

export interface PilotDistrict {
  /** UUID for the pilot district organization. */
  readonly id: string;
  /** Human readable name shown in admin tooling. */
  readonly name: string;
  /** ISO-style district code used by legacy imports. */
  readonly districtCode: string;
  /** Province label used for reporting dashboards. */
  readonly province: string;
}

export interface PilotTenant {
  /** Organization UUID for the SACCO tenant (matches organizations/org_memberships). */
  readonly id: string;
  /** SACCO record UUID in app.saccos. */
  readonly saccoId: string;
  /** URL-safe slug for analytics and support dashboards. */
  readonly slug: string;
  /** Marketing/ops display name. */
  readonly displayName: string;
  /** Sector name (human readable).
   *  Matches the sector column in app.saccos for search filters.
   */
  readonly sectorName: string;
  /** Sector code used in member imports and lookups. */
  readonly sectorCode: string;
  /** Default merchant code used for MoMo integrations. */
  readonly merchantCode: string;
  /** Default contact email surfaced in support tooling. */
  readonly contactEmail: string;
  /** Parent district organization UUID. */
  readonly districtOrgId: string;
}

export interface TenantFeatureFlag {
  readonly key: FeatureFlagName;
  /** Description used in the admin panel. */
  readonly description: string;
  /** Tenants that have the feature enabled during pilot rollout. */
  readonly pilotTenants: readonly string[];
  /** Default value when the tenant is not explicitly targeted. */
  readonly defaultValue: boolean;
  /** Rollout state for stakeholder communication. */
  readonly rollout: "pilot" | "graduated";
}

export type TenantFeatureFlags = Readonly<Record<FeatureFlagName, boolean>>;

export const PILOT_DISTRICT: PilotDistrict = Object.freeze({
  id: "2b9bca31-9003-4f45-8858-86f0ad88ba63",
  name: "Nyamagabe District",
  districtCode: "NYAMAGABE",
  province: "Southern Province",
});

export const PILOT_TENANTS: ReadonlyArray<PilotTenant> = Object.freeze([
  {
    id: "d781e07d-189d-44f8-bab6-ca60aae0a4cf",
    saccoId: "451e3975-5226-4e88-b24e-bc7a0c7e529f",
    slug: "nyamagabe-gasaka",
    displayName: "Ingenzi Gasaka SACCO",
    sectorName: "Gasaka",
    sectorCode: "GASAKA",
    merchantCode: "MC-NYMG-GASAKA",
    contactEmail: "gasaka.manager@pilot.ibimina.rw",
    districtOrgId: PILOT_DISTRICT.id,
  },
  {
    id: "687f4414-c400-4c73-ad41-82da2f6822f9",
    saccoId: "34eb362d-05c8-4785-b675-e5da2600b99e",
    slug: "nyamagabe-kaduha",
    displayName: "Urufunguzo rw'Ubukire Kaduha SACCO",
    sectorName: "Kaduha",
    sectorCode: "KADUHA",
    merchantCode: "MC-NYMG-KADUHA",
    contactEmail: "kaduha.manager@pilot.ibimina.rw",
    districtOrgId: PILOT_DISTRICT.id,
  },
  {
    id: "f27b46ee-24cb-4ca2-acf2-38ca857d406b",
    saccoId: "7d0d4f7c-b129-4015-adba-59b95686f25f",
    slug: "nyamagabe-kamegeri",
    displayName: "SACCO Indahigwa Kamegeri",
    sectorName: "Kamegeri",
    sectorCode: "KAMEGERI",
    merchantCode: "MC-NYMG-KAMEGERI",
    contactEmail: "kamegeri.manager@pilot.ibimina.rw",
    districtOrgId: PILOT_DISTRICT.id,
  },
]);

export const PILOT_TENANT_IDS = Object.freeze(PILOT_TENANTS.map((tenant) => tenant.id));

/**
 * Dedicated beta cohort for staged staff console rollouts.
 *
 * The initial beta focuses on two Nyamagabe SACCOs that have an
 * embedded change-management team and are already participating in
 * Atlas UI research. They provide rapid feedback without impacting the
 * wider pilot pool.
 */
export const STAFF_BETA_TENANT_IDS = Object.freeze([PILOT_TENANTS[0]!.id, PILOT_TENANTS[1]!.id]);

const pilotTenantIdentifierSet = new Set(
  PILOT_TENANTS.flatMap(({ id, slug }) => [id, slug]).map((identifier) => identifier.toLowerCase())
);

const FEATURE_FLAG_DEFINITIONS: Readonly<Record<FeatureFlagName, TenantFeatureFlag>> =
  Object.freeze({
    directory: {
      key: "directory",
      description:
        "Enable staff directory search and pilot deflection experiments for Nyamagabe tenants.",
      pilotTenants: PILOT_TENANT_IDS,
      defaultValue: false,
      rollout: "pilot",
    },
    ticketing: {
      key: "ticketing",
      description:
        "Enable lightweight ticket capture so support can triage escalations without leaving SACCO+.",
      pilotTenants: PILOT_TENANT_IDS,
      defaultValue: false,
      rollout: "pilot",
    },
    nfcReferenceCards: {
      key: "nfcReferenceCards",
      description: "Issue NFC reference cards and secure provisioning tokens for teller devices.",
      pilotTenants: PILOT_TENANT_IDS,
      defaultValue: false,
      rollout: "pilot",
    },
    memberVouchers: {
      key: "memberVouchers",
      description: "Enable digital voucher issuance for savings groups and merchant redemption.",
      pilotTenants: PILOT_TENANT_IDS,
      defaultValue: false,
      rollout: "pilot",
    },
    memberLoans: {
      key: "memberLoans",
      description:
        "Enable lightweight loan application capture and fulfilment tracking for members.",
      pilotTenants: PILOT_TENANT_IDS,
      defaultValue: false,
      rollout: "pilot",
    },
    pwaFallback: {
      key: "pwaFallback",
      description:
        "Surface the responsive PWA fallback when native modules are disabled by feature flags.",
      pilotTenants: PILOT_TENANT_IDS,
      defaultValue: true,
      rollout: "graduated",
    },
    commandPalette: {
      key: "commandPalette",
      description:
        "Enable the Atlas command palette for keyboard-driven navigation and quick actions.",
      pilotTenants: STAFF_BETA_TENANT_IDS,
      defaultValue: false,
      rollout: "pilot",
    },
    atlasAssistant: {
      key: "atlasAssistant",
      description:
        "Expose the Atlas AI assistant toggle and chat workflows to staffed beta cohorts.",
      pilotTenants: STAFF_BETA_TENANT_IDS,
      defaultValue: false,
      rollout: "pilot",
    },
    offlineBanner: {
      key: "offlineBanner",
      description:
        "Show the resilient offline banner and queue controls during connectivity disruptions.",
      pilotTenants: STAFF_BETA_TENANT_IDS,
      defaultValue: false,
      rollout: "pilot",
    },
    migratedWorkflows: {
      key: "migratedWorkflows",
      description:
        "Route staff beta tenants to the migrated analytics, reports, and ops flows in Atlas UI.",
      pilotTenants: STAFF_BETA_TENANT_IDS,
      defaultValue: false,
      rollout: "pilot",
    },
  });

export const featureFlagDefinitions = FEATURE_FLAG_DEFINITIONS;

const featureFlagTargetSets: Readonly<Record<FeatureFlagName, ReadonlySet<string>>> = Object.freeze(
  Object.fromEntries(
    Object.entries(FEATURE_FLAG_DEFINITIONS).map(([flag, definition]) => [
      flag as FeatureFlagName,
      new Set(definition.pilotTenants.map((id) => id.toLowerCase())),
    ])
  ) as unknown as Record<FeatureFlagName, ReadonlySet<string>>
);

export function normalizeTenantId(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.toLowerCase();
}

export function isPilotTenant(tenantId: string | null | undefined): boolean {
  const normalized = normalizeTenantId(tenantId);
  if (!normalized) {
    return false;
  }
  return pilotTenantIdentifierSet.has(normalized);
}

export function resolveCanonicalTenantId(tenantId: string | null | undefined): string | null {
  const normalized = normalizeTenantId(tenantId);
  if (!normalized) {
    return null;
  }

  const match = PILOT_TENANTS.find((tenant) => {
    const candidates = [
      tenant.id,
      tenant.slug,
      tenant.saccoId,
      tenant.sectorCode,
      tenant.merchantCode,
    ];
    return candidates.some((candidate) => candidate.toLowerCase() === normalized);
  });

  return match ? match.id.toLowerCase() : null;
}

export function isFeatureEnabledForTenant(
  flag: FeatureFlagName,
  tenantId: string | null | undefined
): boolean {
  const definition = FEATURE_FLAG_DEFINITIONS[flag];
  if (!definition) {
    return false;
  }

  if (definition.pilotTenants.length === 0) {
    return definition.defaultValue;
  }

  // Normalize tenant ID (handle null/undefined)
  if (!tenantId) {
    return definition.defaultValue;
  }

  return featureFlagTargetSets[flag].has(tenantId);
}

export function getTenantFeatureFlags(tenantId: string | null | undefined): TenantFeatureFlags {
  return Object.freeze({
    directory: isFeatureEnabledForTenant("directory", tenantId),
    ticketing: isFeatureEnabledForTenant("ticketing", tenantId),
    nfcReferenceCards: isFeatureEnabledForTenant("nfcReferenceCards", tenantId),
    memberVouchers: isFeatureEnabledForTenant("memberVouchers", tenantId),
    memberLoans: isFeatureEnabledForTenant("memberLoans", tenantId),
    pwaFallback: isFeatureEnabledForTenant("pwaFallback", tenantId),
    commandPalette: isFeatureEnabledForTenant("commandPalette", tenantId),
    atlasAssistant: isFeatureEnabledForTenant("atlasAssistant", tenantId),
    offlineBanner: isFeatureEnabledForTenant("offlineBanner", tenantId),
    migratedWorkflows: isFeatureEnabledForTenant("migratedWorkflows", tenantId),
  });
}
