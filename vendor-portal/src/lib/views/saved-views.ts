"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ColumnPinningState,
  ColumnOrderState,
  ColumnVisibilityState,
  SortingState,
} from "@tanstack/react-table";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { logWarn } from "@/lib/observability/logger";

export type TableDensity = "compact" | "cozy" | "comfortable";

export interface SavedViewConfig {
  columnVisibility?: ColumnVisibilityState;
  columnPinning?: ColumnPinningState;
  columnOrder?: ColumnOrderState;
  sorting?: SortingState;
  density?: TableDensity;
  filters?: Record<string, unknown>;
}

export interface SavedViewRecord {
  id: string;
  name: string;
  scope: string;
  user_id: string;
  role: string | null;
  config: SavedViewConfig;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface SavedViewInput {
  scope: string;
  name: string;
  userId: string;
  role?: string | null;
  config: SavedViewConfig;
  viewId?: string;
  makeDefault?: boolean;
}

const supabase = typeof window === "undefined" ? null : getSupabaseBrowserClient();

async function fetchSavedViews(scope: string): Promise<SavedViewRecord[]> {
  if (!supabase) return [];
  const { data, error } = await (supabase as any)
    .from("user_saved_views")
    .select("id,name,scope,user_id,role,config,is_default,created_at,updated_at")
    .eq("scope", scope)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) {
    logWarn("savedViews.fetch_failed", { error, scope });
    return [];
  }

  return (data ?? []).map((item: any) => ({
    ...item,
    config: (item.config ?? {}) as SavedViewConfig,
  }));
}

async function persistSavedView(input: SavedViewInput): Promise<SavedViewRecord | null> {
  if (!supabase) return null;
  const payload = {
    scope: input.scope,
    name: input.name,
    user_id: input.userId,
    role: input.role ?? null,
    config: input.config,
    is_default: Boolean(input.makeDefault ?? false),
  };

  if (input.viewId) {
    const { data, error } = await (supabase as any)
      .from("user_saved_views")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", input.viewId)
      .select()
      .maybeSingle();

    if (error) {
      logWarn("savedViews.update_failed", { error, viewId: input.viewId });
      return null;
    }

    return data
      ? ({ ...data, config: (data.config ?? {}) as SavedViewConfig } as SavedViewRecord)
      : null;
  }

  const { data, error } = await (supabase as any)
    .from("user_saved_views")
    .insert({ ...payload, created_at: new Date().toISOString() })
    .select()
    .maybeSingle();

  if (error) {
    logWarn("savedViews.save_failed", { error });
    return null;
  }

  return data
    ? ({ ...data, config: (data.config ?? {}) as SavedViewConfig } as SavedViewRecord)
    : null;
}

async function removeSavedView(viewId: string) {
  if (!supabase) return;
  const { error } = await (supabase as any).from("user_saved_views").delete().eq("id", viewId);
  if (error) {
    logWarn("savedViews.delete_failed", { error, viewId });
  }
}

async function markDefault(viewId: string, scope: string, userId: string) {
  if (!supabase) return;
  const client = supabase as any;
  await client
    .from("user_saved_views")
    .update({ is_default: false })
    .eq("scope", scope)
    .eq("user_id", userId);
  const { error } = await client
    .from("user_saved_views")
    .update({ is_default: true })
    .eq("id", viewId);
  if (error) {
    logWarn("savedViews.mark_default_failed", { error, viewId, scope, userId });
  }
}

interface UseSavedViewsOptions {
  scope?: string;
  userId?: string;
  role?: string | null;
  onApply?: (config: SavedViewConfig, view: SavedViewRecord) => void;
}

export function useSavedViews({ scope, userId, role, onApply }: UseSavedViewsOptions) {
  const [views, setViews] = useState<SavedViewRecord[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const appliedRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!scope || !userId) return;
    setLoading(true);
    setError(null);
    try {
      const fetched = await fetchSavedViews(scope);
      setViews(
        fetched.filter((view) => {
          if (view.user_id === userId) return true;
          if (view.role && role && view.role === role) return true;
          return false;
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load saved views");
    } finally {
      setLoading(false);
    }
  }, [role, scope, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const applyView = useCallback(
    (viewId: string) => {
      const view = views.find((candidate) => candidate.id === viewId);
      if (!view) return;
      appliedRef.current = viewId;
      setActiveViewId(viewId);
      onApply?.(view.config, view);
    },
    [onApply, views]
  );

  const saveView = useCallback(
    async (payload: Omit<SavedViewInput, "scope" | "userId"> & { viewId?: string }) => {
      if (!scope || !userId) return null;
      const next = await persistSavedView({ ...payload, scope, userId, role });
      if (!next) return null;
      setViews((current) => {
        const without = current.filter((item) => item.id !== next.id);
        return [next, ...without];
      });
      if (payload.makeDefault) {
        await markDefault(next.id, scope, userId);
      }
      return next;
    },
    [role, scope, userId]
  );

  const deleteView = useCallback(
    async (viewId: string) => {
      await removeSavedView(viewId);
      setViews((current) => current.filter((item) => item.id !== viewId));
      if (activeViewId === viewId) {
        setActiveViewId(null);
        appliedRef.current = null;
      }
    },
    [activeViewId]
  );

  const setDefaultView = useCallback(
    async (viewId: string) => {
      if (!scope || !userId) return;
      await markDefault(viewId, scope, userId);
      setViews((current) => current.map((item) => ({ ...item, is_default: item.id === viewId })));
    },
    [scope, userId]
  );

  const defaultViewId = useMemo(() => views.find((view) => view.is_default)?.id ?? null, [views]);

  return {
    views,
    loading,
    error,
    refresh,
    applyView,
    saveView,
    deleteView,
    setDefaultView,
    activeViewId,
    defaultViewId,
    setActiveViewId,
  };
}
