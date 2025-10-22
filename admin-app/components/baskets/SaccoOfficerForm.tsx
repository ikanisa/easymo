"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import {
  type SaccoRow,
  useSaccosQuery,
  basketsQueryKeys,
} from "@/lib/queries/baskets";
import { getAdminApiPath } from "@/lib/routes";
import styles from "./SaccoOfficerForm.module.css";

const SACCO_OPTIONS_PARAMS = { limit: 200, status: 'active' } as const;

interface SaccoOfficerFormProps {
  onCreated?: () => void;
}

export function SaccoOfficerForm({ onCreated }: SaccoOfficerFormProps) {
  const { data: saccoData } = useSaccosQuery(SACCO_OPTIONS_PARAMS);
  const saccoOptionsData = saccoData?.data as SaccoRow[] | undefined;
  const saccoOptions = useMemo(
    () => saccoOptionsData ?? [],
    [saccoOptionsData],
  );

  const [saccoId, setSaccoId] = useState<string>(saccoOptions[0]?.id ?? '');
  const [userId, setUserId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ userId: string; label: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [role, setRole] = useState<'manager' | 'officer' | 'teller' | 'compliance'>("officer");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { pushToast } = useToast();

  useEffect(() => {
    if (!saccoId && saccoOptions.length) {
      setSaccoId(saccoOptions[0].id);
    }
  }, [saccoOptions, saccoId]);

  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSuggestions([]);
      return undefined;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `${getAdminApiPath("baskets", "search", "users")}?q=${encodeURIComponent(searchTerm)}&limit=8`,
          {
            cache: 'no-store',
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          setSuggestions([]);
          return;
        }
        const data = await response.json().catch(() => null);
        setSuggestions(
          (data?.data ?? []).map((entry: { userId: string; displayName?: string; msisdn?: string }) => ({
            userId: entry.userId,
            label: [entry.displayName ?? '—', entry.msisdn ?? '—']
              .filter(Boolean)
              .join(' • '),
          })),
        );
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error('user_search_failed', error);
          setSuggestions([]);
        }
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [searchTerm]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!saccoId || !userId.trim()) {
      pushToast("Provide SACCO and user ID.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(getAdminApiPath("baskets", "saccos", "officers"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saccoId, userId, role }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        pushToast(data?.message ?? "Failed to add officer.", "error");
        return;
      }

      pushToast("Officer added.", "success");
      setUserId("");
      setRole("officer");
      onCreated?.();
    } catch (error) {
      console.error("sacco_officer_create_failed", error);
      pushToast("Unexpected error while adding officer.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.row}>
        <label>
          <span>SACCO branch</span>
          <select
            value={saccoId}
            onChange={(event) => setSaccoId(event.target.value)}
          >
            <option value="" disabled>
              Select branch
            </option>
            {saccoOptions.map((sacco) => (
              <option key={sacco.id} value={sacco.id}>
                {sacco.name}
                {sacco.branchCode ? ` (${sacco.branchCode})` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.userColumn}>
          <span>User</span>
          <input
            required
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setUserId('');
            }}
            placeholder="Search by name or MSISDN"
            autoComplete="off"
          />
          {suggestions.length ? (
            <ul className={styles.suggestions}>
              {suggestions.map((option) => (
                <li key={option.userId}>
                  <button
                    type="button"
                    onClick={() => {
                      setUserId(option.userId);
                      setSearchTerm(option.label);
                      setSuggestions([]);
                    }}
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {isSearching ? <span className={styles.helper}>Searching…</span> : null}
          {userId ? (
            <span className={styles.helper}>Selected user: {userId}</span>
          ) : null}
        </label>
        <label>
          <span>Role</span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as typeof role)}
          >
            <option value="manager">Manager</option>
            <option value="officer">Officer</option>
            <option value="teller">Teller</option>
            <option value="compliance">Compliance</option>
          </select>
        </label>
      </div>
      <Button type="submit" size="sm" disabled={isSubmitting}>
        {isSubmitting ? "Adding…" : "Add officer"}
      </Button>
    </form>
  );
}
