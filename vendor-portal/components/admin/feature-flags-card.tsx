"use client";

import { useEffect, useMemo, useState } from "react";

import type { FlagAdminSnapshot } from "@ibimina/flags";

import { useToast } from "@/providers/toast-provider";
import { useTranslation } from "@/providers/i18n-provider";

import { type FlagChange } from "@ibimina/flags";

interface BaselineState {
  global: Record<string, FlagAdminSnapshot["flags"][number]["global"]>;
  countries: Record<
    string,
    Record<string, FlagAdminSnapshot["flags"][number]["countries"][string] | null>
  >;
  partners: Record<
    string,
    Record<string, FlagAdminSnapshot["flags"][number]["partners"][string] | null>
  >;
}

type DraftState = {
  global: Record<string, boolean>;
  countries: Record<string, Record<string, boolean | null>>;
  partners: Record<string, Record<string, boolean | null>>;
};

type OverrideValue = "inherit" | "enabled" | "disabled";

const overrideToDraft = (value: OverrideValue): boolean | null => {
  if (value === "inherit") return null;
  return value === "enabled";
};

const draftToOverride = (value: boolean | null): OverrideValue => {
  if (value === null || value === undefined) return "inherit";
  return value ? "enabled" : "disabled";
};

const buildBaseline = (snapshot: FlagAdminSnapshot): BaselineState => {
  const global: BaselineState["global"] = {};
  const countries: BaselineState["countries"] = {};
  const partners: BaselineState["partners"] = {};

  snapshot.flags.forEach((entry) => {
    global[entry.key] = entry.global;

    snapshot.metadata.countries.forEach((country) => {
      if (!countries[country.id]) {
        countries[country.id] = {};
      }
      countries[country.id]![entry.key] = entry.countries[country.id] ?? null;
    });

    snapshot.metadata.partners.forEach((partner) => {
      if (!partners[partner.id]) {
        partners[partner.id] = {};
      }
      partners[partner.id]![entry.key] = entry.partners[partner.id] ?? null;
    });
  });

  return { global, countries, partners };
};

const buildDraft = (snapshot: FlagAdminSnapshot, baseline: BaselineState): DraftState => {
  const draft: DraftState = { global: {}, countries: {}, partners: {} };

  snapshot.flags.forEach((entry) => {
    const base = baseline.global[entry.key]?.enabled;
    draft.global[entry.key] = base ?? entry.definition.defaultValue ?? false;
  });

  snapshot.metadata.countries.forEach((country) => {
    const map: Record<string, boolean | null> = {};
    snapshot.flags.forEach((entry) => {
      const base = baseline.countries[country.id]?.[entry.key] ?? null;
      map[entry.key] = base ? base.enabled : null;
    });
    draft.countries[country.id] = map;
  });

  snapshot.metadata.partners.forEach((partner) => {
    const map: Record<string, boolean | null> = {};
    snapshot.flags.forEach((entry) => {
      const base = baseline.partners[partner.id]?.[entry.key] ?? null;
      map[entry.key] = base ? base.enabled : null;
    });
    draft.partners[partner.id] = map;
  });

  return draft;
};

const computeChanges = (
  snapshot: FlagAdminSnapshot,
  draft: DraftState,
  baseline: BaselineState
): FlagChange[] => {
  const changes: FlagChange[] = [];

  snapshot.flags.forEach((entry) => {
    const desired = draft.global[entry.key];
    const current = baseline.global[entry.key]?.enabled ?? entry.definition.defaultValue ?? false;
    if (desired !== current) {
      changes.push({ key: entry.key, scope: "global", value: desired });
    }
  });

  snapshot.metadata.countries.forEach((country) => {
    const countryDraft = draft.countries[country.id] ?? {};
    snapshot.flags.forEach((entry) => {
      const desired = countryDraft[entry.key] ?? null;
      const current = baseline.countries[country.id]?.[entry.key]?.enabled ?? null;
      if (desired !== current) {
        changes.push({ key: entry.key, scope: "country", targetId: country.id, value: desired });
      }
    });
  });

  snapshot.metadata.partners.forEach((partner) => {
    const partnerDraft = draft.partners[partner.id] ?? {};
    snapshot.flags.forEach((entry) => {
      const desired = partnerDraft[entry.key] ?? null;
      const current = baseline.partners[partner.id]?.[entry.key]?.enabled ?? null;
      if (desired !== current) {
        changes.push({ key: entry.key, scope: "partner", targetId: partner.id, value: desired });
      }
    });
  });

  return changes;
};

const formatDate = (value: string | null) => {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

export function FeatureFlagsCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snapshot, setSnapshot] = useState<FlagAdminSnapshot | null>(null);
  const [baseline, setBaseline] = useState<BaselineState | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/feature-flags", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = (await response.json()) as FlagAdminSnapshot;
      const nextBaseline = buildBaseline(data);
      const nextDraft = buildDraft(data, nextBaseline);
      setSnapshot(data);
      setBaseline(nextBaseline);
      setDraft(nextDraft);
      setSelectedCountry((prev) => prev ?? data.metadata.countries[0]?.id ?? null);
      setSelectedPartner((prev) => prev ?? data.metadata.partners[0]?.id ?? null);
    } catch (error) {
      console.error("[feature-flags] Failed to load", error);
      toast.error(t("admin.flags.loadFailed", "Unable to load feature flags"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changes = useMemo(() => {
    if (!snapshot || !draft || !baseline) {
      return [] as FlagChange[];
    }
    return computeChanges(snapshot, draft, baseline);
  }, [snapshot, draft, baseline]);

  const lastUpdated = useMemo(() => {
    if (!snapshot) return null;
    const timestamps: string[] = [];
    snapshot.flags.forEach((entry) => {
      if (entry.global?.updatedAt) timestamps.push(entry.global.updatedAt);
      Object.values(entry.countries).forEach((record) => {
        if (record?.updatedAt) timestamps.push(record.updatedAt);
      });
      Object.values(entry.partners).forEach((record) => {
        if (record?.updatedAt) timestamps.push(record.updatedAt);
      });
    });
    if (!timestamps.length) {
      return null;
    }
    return timestamps.sort().at(-1) ?? null;
  }, [snapshot]);

  const handleReset = () => {
    if (!snapshot || !baseline) return;
    setDraft(buildDraft(snapshot, baseline));
    toast.info(t("admin.flags.reset", "Changes discarded"));
  };

  const handleSave = async () => {
    if (!changes.length) {
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/feature-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Request failed");
      }

      toast.success(t("admin.flags.saved", "Flags updated"));
      await refresh();
    } catch (error) {
      console.error("[feature-flags] Failed to save", error);
      toast.error(t("admin.flags.saveFailed", "Failed to save flags"));
    } finally {
      setSaving(false);
    }
  };

  const updateGlobal = (key: string, value: boolean) => {
    setDraft((state) => {
      if (!state) return state;
      return {
        ...state,
        global: {
          ...state.global,
          [key]: value,
        },
      };
    });
  };

  const updateOverride = (
    level: "countries" | "partners",
    targetId: string,
    key: string,
    next: OverrideValue
  ) => {
    setDraft((state) => {
      if (!state) return state;
      const currentLevel = state[level][targetId] ?? {};
      return {
        ...state,
        [level]: {
          ...state[level],
          [targetId]: {
            ...currentLevel,
            [key]: overrideToDraft(next),
          },
        },
      };
    });
  };

  if (loading || !snapshot || !draft) {
    return (
      <div className="space-y-4">
        <div className="h-4 w-48 animate-pulse rounded bg-white/10" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={`skeleton-${index}`} className="h-16 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  const selectedCountryId = selectedCountry ?? snapshot.metadata.countries[0]?.id ?? null;
  const selectedPartnerId = selectedPartner ?? snapshot.metadata.partners[0]?.id ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-neutral-2">
          {lastUpdated && (
            <span>
              {t("admin.flags.updatedAt", "Updated")}: {formatDate(lastUpdated)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={!changes.length || saving}
            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70 transition hover:border-white/40 disabled:opacity-50"
          >
            {t("common.reset", "Reset")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!changes.length || saving}
            className="interactive-scale rounded-full bg-kigali px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-ink shadow-glass disabled:opacity-60"
          >
            {saving ? t("common.saving", "Saving…") : t("common.save", "Save")}
          </button>
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-0">
          {t("admin.flags.global", "Global defaults")}
        </h3>
        <div className="grid gap-3">
          {snapshot.flags.map((flag) => (
            <div
              key={flag.key}
              className="flex items-center justify-between gap-6 rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div>
                <p className="text-sm font-semibold text-neutral-0">
                  {flag.definition.description ?? flag.key}
                </p>
                <p className="text-xs uppercase tracking-[0.2em] text-neutral-2">{flag.key}</p>
              </div>
              <label className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-1">
                <span>
                  {draft.global[flag.key]
                    ? t("common.enabled", "Enabled")
                    : t("common.disabled", "Disabled")}
                </span>
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-white/10 bg-white/10 accent-kigali"
                  checked={draft.global[flag.key]}
                  onChange={(event) => updateGlobal(flag.key, event.target.checked)}
                />
              </label>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-neutral-0">
            {t("admin.flags.countryOverrides", "Country overrides")}
          </h3>
          {snapshot.metadata.countries.length > 0 ? (
            <select
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-neutral-0"
              value={selectedCountryId ?? ""}
              onChange={(event) => setSelectedCountry(event.target.value || null)}
            >
              {snapshot.metadata.countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-neutral-2">
              {t("admin.flags.noCountries", "No country metadata configured")}
            </span>
          )}
        </div>
        {selectedCountryId ? (
          <div className="space-y-3">
            {snapshot.flags.map((flag) => (
              <div
                key={`${selectedCountryId}-${flag.key}`}
                className="flex items-center justify-between gap-6 rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-neutral-0">
                    {flag.definition.description ?? flag.key}
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-neutral-2">{flag.key}</p>
                </div>
                <OverrideSelect
                  value={draftToOverride(draft.countries[selectedCountryId]?.[flag.key] ?? null)}
                  onChange={(next) =>
                    updateOverride("countries", selectedCountryId, flag.key, next)
                  }
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-neutral-2">
            {t("admin.flags.selectCountry", "Select a country to manage overrides")}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-neutral-0">
            {t("admin.flags.partnerOverrides", "Partner overrides")}
          </h3>
          {snapshot.metadata.partners.length > 0 ? (
            <select
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-neutral-0"
              value={selectedPartnerId ?? ""}
              onChange={(event) => setSelectedPartner(event.target.value || null)}
            >
              {snapshot.metadata.partners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-neutral-2">
              {t("admin.flags.noPartners", "No partner metadata configured")}
            </span>
          )}
        </div>
        {selectedPartnerId ? (
          <div className="space-y-3">
            {snapshot.flags.map((flag) => (
              <div
                key={`${selectedPartnerId}-${flag.key}`}
                className="flex items-center justify-between gap-6 rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-neutral-0">
                    {flag.definition.description ?? flag.key}
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-neutral-2">{flag.key}</p>
                </div>
                <OverrideSelect
                  value={draftToOverride(draft.partners[selectedPartnerId]?.[flag.key] ?? null)}
                  onChange={(next) => updateOverride("partners", selectedPartnerId, flag.key, next)}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-neutral-2">
            {t("admin.flags.selectPartner", "Select a partner to manage overrides")}
          </p>
        )}
      </section>
    </div>
  );
}

function OverrideSelect({
  value,
  onChange,
}: {
  value: OverrideValue;
  onChange: (next: OverrideValue) => void;
}) {
  return (
    <select
      className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.2em] text-neutral-0"
      value={value}
      onChange={(event) => onChange(event.target.value as OverrideValue)}
    >
      <option value="inherit">Inherit</option>
      <option value="enabled">Enabled</option>
      <option value="disabled">Disabled</option>
    </select>
  );
}
