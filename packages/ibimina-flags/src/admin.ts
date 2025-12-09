import type { SupabaseClient } from "@supabase/supabase-js";

import { featureFlagDefinitions } from "@ibimina/config";

import type {
  FlagAdminSnapshot,
  FlagChange,
  FlagMatrixEntry,
  FlagRecord,
  FlagScope,
} from "./types";

interface RawFlagRow {
  id: string;
  key: string;
  is_enabled: boolean;
  country_id: string | null;
  org_id: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

interface RawCountryRow {
  id?: string;
  iso2?: string;
  iso3?: string;
  name?: string;
}

interface RawPartnerRow {
  id: string;
  name?: string;
  slug?: string;
  country_id?: string | null;
  type?: string | null;
}

const toDefinitionSummary = (key: string) => {
  const definition = Object.values(featureFlagDefinitions).find((entry) => entry.key === key);
  if (!definition) {
    return { key };
  }

  return {
    key: definition.key,
    description: definition.description,
    defaultValue: definition.defaultValue,
    rollout: definition.rollout,
  };
};

const determineScope = (row: RawFlagRow): { scope: FlagScope; targetId: string | null } => {
  if (row.org_id) {
    return { scope: "partner", targetId: row.org_id };
  }
  if (row.country_id) {
    return { scope: "country", targetId: row.country_id };
  }
  return { scope: "global", targetId: null };
};

const toRecord = (row: RawFlagRow, scope: FlagScope, targetId: string | null): FlagRecord => ({
  id: row.id,
  key: row.key,
  enabled: Boolean(row.is_enabled),
  scope,
  targetId,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by,
});

const mapCountries = (rows: RawCountryRow[] | null | undefined) =>
  (rows ?? []).map((row) => ({
    id: String(row.id ?? row.iso3 ?? row.iso2 ?? ""),
    name: row.name ?? row.iso3 ?? row.iso2 ?? "Unknown",
    iso3: row.iso3 ?? null,
  }));

const mapPartners = (rows: RawPartnerRow[] | null | undefined) =>
  (rows ?? [])
    .filter((row) => Boolean(row.id))
    .map((row) => ({
      id: row.id,
      name: row.name ?? row.slug ?? row.id,
      countryId: row.country_id ?? null,
    }));

const loadCountries = async (client: SupabaseClient) => {
  const { data, error } = await client
    .from("countries")
    .select("id, iso2, iso3, name")
    .order("name", {
      ascending: true,
    });

  if (error) {
    console.warn("[flags] Failed to load countries metadata", error);
    return [];
  }

  return mapCountries(data as RawCountryRow[]);
};

const loadPartners = async (client: SupabaseClient) => {
  const tryLoad = async (relation: string) => {
    const { data, error } = await client
      .from(relation)
      .select("id, name, slug, country_id, type")
      .order("name", { ascending: true })
      .returns<RawPartnerRow[]>();

    if (error) {
      return null;
    }

    return data;
  };

  const primary = await tryLoad("app.organizations");
  if (primary) {
    return mapPartners(primary);
  }

  const fallback = await tryLoad("organizations");
  if (fallback) {
    return mapPartners(fallback);
  }

  console.warn("[flags] Failed to load partner metadata from Supabase");
  return [];
};

const buildEntries = (keys: Iterable<string>): FlagMatrixEntry[] =>
  Array.from(new Set(keys))
    .sort((a, b) => a.localeCompare(b))
    .map((key) => ({
      key,
      definition: toDefinitionSummary(key),
      global: null,
      countries: {},
      partners: {},
    }));

const matchFromChange = (change: FlagChange) => {
  if (change.scope === "global") {
    return { countryId: null, orgId: null, targetId: null };
  }

  if (!change.targetId) {
    throw new Error(`Missing targetId for ${change.scope} flag change on ${change.key}`);
  }

  if (change.scope === "country") {
    return { countryId: change.targetId, orgId: null, targetId: change.targetId };
  }

  return { countryId: null, orgId: change.targetId, targetId: change.targetId };
};

export const createFeatureFlagAdmin = (client: SupabaseClient) => {
  const loadSnapshot = async (keys?: string[]): Promise<FlagAdminSnapshot> => {
    const requestedKeys = keys && keys.length ? new Set(keys) : null;

    const { data, error } = await client
      .from("feature_flags")
      .select("id, key, is_enabled, country_id, org_id, updated_at, updated_by")
      .returns<RawFlagRow[]>();

    if (error) {
      throw error;
    }

    const derivedKeys = new Set(
      data?.map((row) => row.key) ??
        Object.values(featureFlagDefinitions).map((definition) => definition.key)
    );

    if (requestedKeys) {
      requestedKeys.forEach((key) => derivedKeys.add(key));
    }

    const entries = buildEntries(derivedKeys);
    const entryMap = new Map(entries.map((entry) => [entry.key, entry]));

    data?.forEach((row) => {
      if (requestedKeys && !requestedKeys.has(row.key)) {
        return;
      }

      const entry = entryMap.get(row.key);
      if (!entry) {
        return;
      }

      const { scope, targetId } = determineScope(row);
      const record = toRecord(row, scope, targetId);

      if (scope === "global") {
        entry.global = record;
      } else if (scope === "country" && targetId) {
        entry.countries[targetId] = record;
      } else if (scope === "partner" && targetId) {
        entry.partners[targetId] = record;
      }
    });

    const [countries, partners] = await Promise.all([loadCountries(client), loadPartners(client)]);

    return {
      flags: entries,
      metadata: { countries, partners },
    };
  };

  const applyChanges = async (changes: FlagChange[]): Promise<void> => {
    if (!changes.length) {
      return;
    }

    await Promise.all(
      changes.map(async (change) => {
        const { countryId, orgId } = matchFromChange(change);

        if (change.value === null) {
          const deleteQuery = client.from("feature_flags").delete().eq("key", change.key);

          if (countryId === null) {
            deleteQuery.is("country_id", null);
          } else if (countryId) {
            deleteQuery.eq("country_id", countryId);
          }

          if (orgId === null) {
            deleteQuery.is("org_id", null);
          } else if (orgId) {
            deleteQuery.eq("org_id", orgId);
          }

          const { error } = await deleteQuery;

          if (error) {
            throw error;
          }

          return;
        }

        const payload = {
          key: change.key,
          is_enabled: change.value,
          country_id: countryId,
          org_id: orgId,
          updated_by: change.actorId ?? null,
        };

        const { error } = await client.from("feature_flags").upsert(payload, {
          onConflict: "feature_flags_unique_scope",
        });

        if (error) {
          throw error;
        }
      })
    );
  };

  return { loadSnapshot, applyChanges };
};
