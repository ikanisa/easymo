"use client";

import { Command as CommandPrimitive } from "cmdk";
import { ArrowUpRight, Filter, Loader2, Search as SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ProfileRow } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { logError } from "@/lib/observability/logger";
import { cn } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";
import { useTranslation } from "@/providers/i18n-provider";
import {
  SaccoSearchCombobox,
  type SaccoSearchResult,
} from "@/components/saccos/sacco-search-combobox";
import { useFocusTrap } from "@/src/lib/a11y/useFocusTrap";

const BADGE_TONE_STYLES = {
  critical: "border-red-500/40 bg-red-500/15 text-red-200",
  info: "border-sky-500/40 bg-sky-500/15 text-sky-100",
  success: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
  warning: "border-amber-500/40 bg-amber-500/15 text-amber-200",
} as const;

type CommandBadgeTone = keyof typeof BADGE_TONE_STYLES;

export interface CommandNavTarget {
  id: string;
  href: string;
  label: string;
  description?: string;
  badge?: { label: string; tone: CommandBadgeTone } | null;
  keywords?: string[];
}

export interface CommandAction {
  id: string;
  label: string;
  description?: string;
  secondaryLabel?: string;
  href?: string;
  onSelect?: () => void | Promise<void>;
  badge?: { label: string; tone: CommandBadgeTone } | null;
  keywords?: string[];
}

export interface CommandActionGroup {
  id: string;
  title: string;
  subtitle?: string;
  actions: CommandAction[];
}

export interface CommandFilterChip {
  id: string;
  label: string;
  active: boolean;
  onActivate?: () => void;
  onClear?: () => void;
  description?: string;
}

export type CommandFilterGenerator = (context: {
  profile: ProfileRow;
  search: string;
  sacco: SaccoSearchResult | null;
}) => CommandFilterChip | CommandFilterChip[] | null;

interface CommandPaletteProviderProps {
  children: ReactNode;
  profile: ProfileRow;
  navTargets: CommandNavTarget[];
  actionGroups?: CommandActionGroup[];
}

type ContextualActionRegistry = Map<string, CommandAction[]>;

type ContextualFilterRegistry = Map<string, CommandFilterGenerator[]>;

type CommandPaletteContextValue = {
  open: boolean;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  registerActions: (key: string, actions: CommandAction[]) => () => void;
  registerFilterGenerators: (key: string, generators: CommandFilterGenerator[]) => () => void;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette(): CommandPaletteContextValue {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  }
  return context;
}

function useStableRegistrationKey(prefix: string) {
  const ref = useRef<string>();
  if (!ref.current) {
    ref.current = `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }
  return ref.current;
}

export function useCommandPaletteActions(
  actions: CommandAction[] | (() => CommandAction[]),
  deps: ReadonlyArray<unknown> = []
) {
  const { registerActions } = useCommandPalette();
  const key = useStableRegistrationKey("palette-actions");
  const memoDeps = useMemo(() => [actions, ...Array.from(deps)], [actions, deps]);
  const computedActions = useMemo(
    () => (typeof actions === "function" ? actions() : actions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    memoDeps
  );
  useEffect(() => registerActions(key, computedActions), [computedActions, key, registerActions]);
}

export function useCommandPaletteFilters(
  generators: CommandFilterGenerator[] | (() => CommandFilterGenerator[]),
  deps: ReadonlyArray<unknown> = []
) {
  const { registerFilterGenerators } = useCommandPalette();
  const key = useStableRegistrationKey("palette-filters");
  const memoDeps = useMemo(() => [generators, ...Array.from(deps)], [generators, deps]);
  const computedGenerators = useMemo(
    () => (typeof generators === "function" ? generators() : generators),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    memoDeps
  );
  useEffect(
    () => registerFilterGenerators(key, computedGenerators),
    [computedGenerators, key, registerFilterGenerators]
  );
}

type SearchCacheEntry = {
  ikimina: IkiminaResult[];
  members: MemberResult[];
  payments: PaymentResult[];
  error?: string | null;
  membersError?: string | null;
  paymentsError?: string | null;
  timestamp: number;
};

type IkiminaResult = {
  id: string;
  name: string;
  code: string;
  status: string;
  saccoName: string | null;
};

type MemberResult = {
  id: string;
  fullName: string;
  memberCode: string | null;
  msisdn: string | null;
  ikiminaId: string | null;
  ikiminaName: string | null;
};

type PaymentResult = {
  id: string;
  amount: number;
  status: string;
  occurredAt: string;
  reference: string | null;
  ikiminaId: string | null;
  ikiminaName: string | null;
  memberId: string | null;
  memberName: string | null;
};

const SEARCH_CACHE = new Map<string, SearchCacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 5;

let cachedSupabaseClient: ReturnType<typeof getSupabaseBrowserClient> | null = null;
let supabaseClientInitError: Error | null = null;

function resolveSupabaseClient() {
  if (cachedSupabaseClient || supabaseClientInitError) {
    return cachedSupabaseClient;
  }

  try {
    cachedSupabaseClient = getSupabaseBrowserClient();
  } catch (error) {
    const resolvedError = error instanceof Error ? error : new Error(String(error));
    supabaseClientInitError = resolvedError;
    logError("command_palette.supabase_init_failed", { error: resolvedError });
    cachedSupabaseClient = null;
  }

  return cachedSupabaseClient;
}

export function CommandPaletteProvider({
  children,
  profile,
  navTargets,
  actionGroups = [],
}: CommandPaletteProviderProps) {
  const [open, setOpen] = useState(false);
  const actionsRef = useRef<ContextualActionRegistry>(new Map());
  const filtersRef = useRef<ContextualFilterRegistry>(new Map());
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [actionsVersion, setActionsVersion] = useState(0);
  const [filtersVersion, setFiltersVersion] = useState(0);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    } else {
      previouslyFocusedRef.current?.focus?.();
      previouslyFocusedRef.current = null;
    }
  }, [open]);

  const registerActions = useCallback<CommandPaletteContextValue["registerActions"]>(
    (key, value) => {
      actionsRef.current.set(key, value);
      setActionsVersion((version) => version + 1);
      return () => {
        actionsRef.current.delete(key);
        setActionsVersion((version) => version + 1);
      };
    },
    []
  );

  const registerFilterGenerators = useCallback<
    CommandPaletteContextValue["registerFilterGenerators"]
  >((key, generators) => {
    filtersRef.current.set(key, generators);
    setFiltersVersion((version) => version + 1);
    return () => {
      filtersRef.current.delete(key);
      setFiltersVersion((version) => version + 1);
    };
  }, []);

  const contextValue = useMemo<CommandPaletteContextValue>(
    () => ({
      open,
      openPalette: () => setOpen(true),
      closePalette: () => setOpen(false),
      togglePalette: () => setOpen((current) => !current),
      registerActions,
      registerFilterGenerators,
    }),
    [open, registerActions, registerFilterGenerators]
  );

  const contextualActions = useMemo(
    () => Array.from(actionsRef.current.values()).flat(),
    // actionsVersion is intentionally included to trigger recomputation
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actionsVersion]
  );

  const contextualFilters = useMemo(
    () => Array.from(filtersRef.current.values()).flat(),
    // filtersVersion is intentionally included to trigger recomputation
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtersVersion]
  );

  return (
    <CommandPaletteContext.Provider value={contextValue}>
      {children}
      <CommandPaletteInternal
        open={open}
        onOpenChange={setOpen}
        profile={profile}
        navTargets={navTargets}
        actionGroups={actionGroups}
        contextualActions={contextualActions}
        contextualFilters={contextualFilters}
      />
    </CommandPaletteContext.Provider>
  );
}

interface CommandPaletteInternalProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  profile: ProfileRow;
  navTargets: CommandNavTarget[];
  actionGroups: CommandActionGroup[];
  contextualActions: CommandAction[];
  contextualFilters: CommandFilterGenerator[];
}

function CommandPaletteInternal({
  open,
  onOpenChange,
  profile,
  navTargets,
  actionGroups,
  contextualActions,
  contextualFilters,
}: CommandPaletteInternalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const supabase = useMemo(() => resolveSupabaseClient(), []);
  const [search, setSearch] = useState("");
  const [ikimina, setIkimina] = useState<IkiminaResult[]>([]);
  const [members, setMembers] = useState<MemberResult[]>([]);
  const [payments, setPayments] = useState<PaymentResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [selectedSacco, setSelectedSacco] = useState<SaccoSearchResult | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [showRefreshBadge, setShowRefreshBadge] = useState(false);
  const toast = useToast();
  const toastShownRef = useRef(false);
  const refreshBadgeTimer = useRef<NodeJS.Timeout | null>(null);
  const dialogContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (refreshBadgeTimer.current) {
        clearTimeout(refreshBadgeTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelectedSacco(null);
      return;
    }

    const cacheKey = `${profile.role}-${profile.sacco_id ?? "all"}`;
    const cached = SEARCH_CACHE.get(cacheKey);
    const cacheFresh = cached ? Date.now() - cached.timestamp < CACHE_TTL_MS : false;

    if (!supabase) {
      const unavailableMessage = t(
        "search.console.supabaseUnavailable",
        "Search is unavailable because Supabase is not configured."
      );
      setIkimina([]);
      setMembers([]);
      setPayments([]);
      setError(unavailableMessage);
      setMembersError(unavailableMessage);
      setPaymentsError(unavailableMessage);
      setLoading(false);
      setMembersLoading(false);
      setPaymentsLoading(false);
      setLastSyncedAt(new Date());
      SEARCH_CACHE.set(cacheKey, {
        ikimina: [],
        members: [],
        payments: [],
        error: unavailableMessage,
        membersError: unavailableMessage,
        paymentsError: unavailableMessage,
        timestamp: Date.now(),
      });
      return;
    }

    let cancelled = false;

    const applyCache = (entry: SearchCacheEntry) => {
      if (cancelled) return;
      setIkimina(entry.ikimina);
      setMembers(entry.members);
      setPayments(entry.payments);
      setError(entry.error ?? null);
      setMembersError(entry.membersError ?? null);
      setPaymentsError(entry.paymentsError ?? null);
      setLoading(false);
      setMembersLoading(false);
      setPaymentsLoading(false);
      setLastSyncedAt(new Date(entry.timestamp));
    };

    if (cached) {
      applyCache(cached);
      if (cacheFresh) {
        return () => {
          cancelled = true;
        };
      }
    } else {
      setLoading(true);
      setMembersLoading(true);
      setPaymentsLoading(true);
      setError(null);
      setMembersError(null);
      setPaymentsError(null);
      setIkimina([]);
      setMembers([]);
      setPayments([]);
    }

    const fetchData = async () => {
      const baseLimit = profile.role === "SYSTEM_ADMIN" ? 400 : 200;
      let queryBuilder = supabase
        .from("ibimina")
        .select("id, name, code, status, saccos(name)")
        .order("updated_at", { ascending: false })
        .limit(baseLimit);

      if (profile.role !== "SYSTEM_ADMIN") {
        if (!profile.sacco_id) {
          if (cancelled) return;
          const message = "Assign yourself to a SACCO to search.";
          setIkimina([]);
          setMembers([]);
          setPayments([]);
          setError(message);
          setMembersError("Assign yourself to a SACCO to search members.");
          setPaymentsError("Assign yourself to a SACCO to search payments.");
          setLoading(false);
          setMembersLoading(false);
          setPaymentsLoading(false);
          setLastSyncedAt(new Date());
          SEARCH_CACHE.set(cacheKey, {
            ikimina: [],
            members: [],
            payments: [],
            error: message,
            membersError: "Assign yourself to a SACCO to search members.",
            paymentsError: "Assign yourself to a SACCO to search payments.",
            timestamp: Date.now(),
          });
          return;
        }
        queryBuilder = queryBuilder.eq("sacco_id", profile.sacco_id);
      }

      const { data, error: supabaseError } = await queryBuilder;
      if (cancelled) return;

      if (supabaseError) {
        logError("command_palette.sacco_fetch_failed", { error: supabaseError });
        const message = supabaseError.message ?? "Failed to load ikimina";
        setError(message);
        setIkimina([]);
        setLoading(false);
        setMembers([]);
        setMembersLoading(false);
        setMembersError("Search unavailable");
        setPayments([]);
        setPaymentsLoading(false);
        setPaymentsError("Search unavailable");
        SEARCH_CACHE.set(cacheKey, {
          ikimina: [],
          members: [],
          payments: [],
          error: message,
          membersError: "Search unavailable",
          paymentsError: "Search unavailable",
          timestamp: Date.now(),
        });
        setLastSyncedAt(new Date());
        return;
      }

      type IkiminaRow = {
        id: string;
        name: string;
        code: string | null;
        status: string;
        saccos: { name: string | null } | null;
      };

      const rows = ((data ?? []) as IkiminaRow[]).map((row) => ({
        id: row.id,
        name: row.name,
        code: row.code ?? "",
        status: row.status,
        saccoName: row.saccos?.name ?? null,
      }));

      setIkimina(rows);
      setLoading(false);

      if (rows.length === 0) {
        setMembers([]);
        setMembersLoading(false);
        setPayments([]);
        setPaymentsLoading(false);
        SEARCH_CACHE.set(cacheKey, {
          ikimina: rows,
          members: [],
          payments: [],
          error: null,
          membersError: null,
          paymentsError: null,
          timestamp: Date.now(),
        });
        setLastSyncedAt(new Date());
        return;
      }

      const groupIds = rows.map((row) => row.id);

      const membersPromise = supabase
        .from("members")
        .select("id, full_name, member_code, phone_number, group:ibimina(id, name)")
        .in("group_id", groupIds)
        .limit(baseLimit);

      const paymentsPromise = supabase
        .schema("app")
        .from("payments")
        .select(
          "id, amount, status, occurred_at, reference, ikimina_id, member_id, group:ikimina(name), member:member_profiles(full_name)"
        )
        .in("ikimina_id", groupIds)
        .limit(baseLimit);

      const [membersRes, paymentsRes] = await Promise.all([membersPromise, paymentsPromise]);
      if (cancelled) return;

      let memberRows: MemberResult[] = [];
      if (membersRes.error) {
        logError("command_palette.members_fetch_failed", { error: membersRes.error });
        setMembersError(membersRes.error.message ?? "Failed to load members");
      } else {
        type MemberRow = {
          id: string;
          full_name: string | null;
          member_code: string | null;
          phone_number: string | null;
          group: { id: string | null; name: string | null } | null;
        };
        memberRows = ((membersRes.data ?? []) as MemberRow[]).map((row) => ({
          id: row.id,
          fullName: row.full_name ?? "Unnamed member",
          memberCode: row.member_code,
          msisdn: row.phone_number,
          ikiminaId: row.group?.id ?? null,
          ikiminaName: row.group?.name ?? null,
        }));
        setMembersError(null);
      }
      setMembers(memberRows);
      setMembersLoading(false);

      let paymentRows: PaymentResult[] = [];
      if (paymentsRes.error) {
        logError("command_palette.payments_fetch_failed", { error: paymentsRes.error });
        setPaymentsError(paymentsRes.error.message ?? "Failed to load payments");
      } else {
        type PaymentRow = {
          id: string;
          amount: number;
          status: string;
          occurred_at: string;
          reference: string | null;
          ikimina_id: string | null;
          member_id: string | null;
          group: { name: string | null } | null;
          member: { full_name: string | null } | null;
        };
        paymentRows = ((paymentsRes.data ?? []) as PaymentRow[]).map((row) => ({
          id: row.id,
          amount: row.amount,
          status: row.status,
          occurredAt: row.occurred_at,
          reference: row.reference,
          ikiminaId: row.ikimina_id,
          ikiminaName: row.group?.name ?? null,
          memberId: row.member_id,
          memberName: row.member?.full_name ?? null,
        }));
        setPaymentsError(null);
      }
      setPayments(paymentRows);
      setPaymentsLoading(false);

      const cacheTimestamp = Date.now();
      SEARCH_CACHE.set(cacheKey, {
        ikimina: rows,
        members: membersRes.error ? [] : memberRows,
        payments: paymentsRes.error ? [] : paymentRows,
        error: null,
        membersError: membersRes.error
          ? (membersRes.error.message ?? "Failed to load members")
          : null,
        paymentsError: paymentsRes.error
          ? (paymentsRes.error.message ?? "Failed to load payments")
          : null,
        timestamp: cacheTimestamp,
      });
      setLastSyncedAt(new Date(cacheTimestamp));
      if (!toastShownRef.current) {
        toast.notify(t("search.console.refreshed", "Search results refreshed"));
        toastShownRef.current = true;
      } else {
        if (refreshBadgeTimer.current) {
          clearTimeout(refreshBadgeTimer.current);
        }
        setShowRefreshBadge(true);
        refreshBadgeTimer.current = setTimeout(() => {
          setShowRefreshBadge(false);
          refreshBadgeTimer.current = null;
        }, 5000);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [open, profile.role, profile.sacco_id, supabase, t, toast]);

  useEffect(() => {
    if (!open) {
      toastShownRef.current = false;
      setShowRefreshBadge(false);
    }
  }, [open]);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-RW", {
        style: "currency",
        currency: "RWF",
        maximumFractionDigits: 0,
      }),
    []
  );

  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-RW", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    []
  );

  useEffect(() => {
    return () => {
      if (refreshBadgeTimer.current) {
        clearTimeout(refreshBadgeTimer.current);
      }
    };
  }, []);

  const saccoFilterChips = useMemo<CommandFilterChip[]>(() => {
    const chips: CommandFilterChip[] = [];
    contextualFilters.forEach((generator) => {
      const result = generator({ profile, search, sacco: selectedSacco });
      if (Array.isArray(result)) {
        chips.push(...result);
      } else if (result) {
        chips.push(result);
      }
    });
    if (selectedSacco) {
      chips.unshift({
        id: "selected-sacco",
        label: selectedSacco.name,
        description: selectedSacco.district
          ? `${selectedSacco.district} · ${selectedSacco.province}`
          : undefined,
        active: true,
        onClear: () => setSelectedSacco(null),
      });
    }
    return chips;
  }, [contextualFilters, profile, search, selectedSacco]);

  const hasResults = useMemo(() => {
    const contextualCount = contextualActions.length;
    const quickActionCount = actionGroups.reduce((total, group) => total + group.actions.length, 0);
    return (
      navTargets.length > 0 ||
      contextualCount > 0 ||
      quickActionCount > 0 ||
      ikimina.length > 0 ||
      members.length > 0 ||
      payments.length > 0
    );
  }, [
    actionGroups,
    contextualActions.length,
    ikimina.length,
    members.length,
    navTargets.length,
    payments.length,
  ]);

  const handleSelect = useCallback(
    async (action: CommandAction) => {
      if (action.href) {
        router.push(action.href);
      }
      if (action.onSelect) {
        await action.onSelect();
      }
      onOpenChange(false);
    },
    [onOpenChange, router]
  );

  useFocusTrap(open, dialogContainerRef, {
    onEscape: () => onOpenChange(false),
    initialFocus: () => searchInputRef.current,
  });

  return (
    <CommandPrimitive.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label={t("search.console.title", "Search console")}
    >
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 md:items-center">
        <div
          ref={dialogContainerRef}
          tabIndex={-1}
          className="glass relative w-full max-w-3xl rounded-3xl border border-white/10 bg-neutral-950/90 p-6 shadow-2xl"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-lg font-semibold text-neutral-0">
              {t("search.console.title", "Search console")}
            </span>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-neutral-2">
              <span className="hidden rounded-full border border-white/15 px-3 py-1 md:inline-flex">
                ⌘K
              </span>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-[0.3em] text-neutral-2 transition hover:border-white/30 hover:text-neutral-0"
              >
                {t("actions.close", "Close")}
              </button>
            </div>
          </div>

          <div className="relative mt-5">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-2" />
            <CommandPrimitive.Input
              ref={searchInputRef}
              autoFocus
              value={search}
              onValueChange={setSearch}
              placeholder={t(
                "search.console.placeholder",
                "Search ikimina, quick actions, or SACCO registry"
              )}
              className="w-full rounded-2xl border border-white/10 bg-white/10 py-3 pl-11 pr-4 text-sm text-neutral-0 placeholder:text-neutral-2 focus:outline-none focus:ring-2 focus:ring-rw-blue"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-neutral-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1">
              <Filter className="h-3.5 w-3.5" />
              {t("search.filters.label", "Filters")}
            </span>
            <SaccoSearchCombobox
              value={selectedSacco}
              onChange={(value) => setSelectedSacco(value)}
              placeholder={t(
                "search.saccoPicker.placeholder",
                "Search Umurenge SACCOs by name or district"
              )}
              className="min-w-[14rem] flex-1"
            />
            {saccoFilterChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={chip.active ? chip.onClear : chip.onActivate}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 transition",
                  chip.active
                    ? "border-rw-blue/60 bg-rw-blue/20 text-neutral-0"
                    : "border-white/10 bg-white/5 text-neutral-2 hover:border-white/20 hover:text-neutral-0"
                )}
              >
                {chip.label}
                {chip.active && chip.onClear && <span aria-hidden>×</span>}
                {chip.description && (
                  <span className="text-[10px] uppercase tracking-[0.3em] text-neutral-3">
                    {chip.description}
                  </span>
                )}
              </button>
            ))}
          </div>

          <CommandPrimitive.List className="mt-5 max-h-[65vh] overflow-y-auto">
            {!hasResults && !loading && !membersLoading && !paymentsLoading && (
              <CommandPrimitive.Empty className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-neutral-2">
                {t("search.console.noResults", "No results match this search yet.")}
              </CommandPrimitive.Empty>
            )}

            {navTargets.length > 0 && (
              <CommandPrimitive.Group heading={t("search.console.navigate", "Navigate")}>
                <div className="mt-2 grid gap-2">
                  {navTargets.map((item) => (
                    <CommandPrimitive.Item
                      key={item.id}
                      value={`${item.label} ${item.description ?? ""} ${(item.keywords ?? []).join(" ")}`}
                      onSelect={() => {
                        router.push(item.href);
                        onOpenChange(false);
                      }}
                      className="flex flex-col rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-neutral-0 transition hover:border-white/20 hover:bg-white/10 data-[selected=true]:border-rw-blue/60 data-[selected=true]:bg-rw-blue/20"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <span className="font-medium">
                            {renderHighlighted(item.label, search)}
                          </span>
                          {item.description && (
                            <span className="block text-[11px] uppercase tracking-[0.3em] text-neutral-2">
                              {renderHighlighted(item.description, search)}
                            </span>
                          )}
                        </div>
                        {item.badge && (
                          <span
                            className={cn(
                              "inline-flex h-min items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.3em]",
                              BADGE_TONE_STYLES[item.badge.tone]
                            )}
                          >
                            {item.badge.label}
                          </span>
                        )}
                      </div>
                    </CommandPrimitive.Item>
                  ))}
                </div>
              </CommandPrimitive.Group>
            )}

            {contextualActions.length > 0 && (
              <CommandPrimitive.Group
                heading={t("search.console.contextual", "Contextual actions")}
              >
                <div className="mt-2 grid gap-2">
                  {contextualActions.map((action) => (
                    <CommandPrimitive.Item
                      key={action.id}
                      value={`${action.label} ${action.description ?? ""} ${action.secondaryLabel ?? ""} ${(action.keywords ?? []).join(" ")}`}
                      onSelect={() => handleSelect(action)}
                      className="flex flex-col rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-neutral-0 transition hover:border-white/20 hover:bg-white/10 data-[selected=true]:border-rw-blue/60 data-[selected=true]:bg-rw-blue/20"
                    >
                      <span className="font-medium">{renderHighlighted(action.label, search)}</span>
                      {action.description && (
                        <span className="text-xs text-neutral-2">
                          {renderHighlighted(action.description, search)}
                        </span>
                      )}
                      {action.secondaryLabel && (
                        <span className="text-[11px] uppercase tracking-[0.3em] text-neutral-3">
                          {renderHighlighted(action.secondaryLabel, search)}
                        </span>
                      )}
                      {action.badge && (
                        <span
                          className={cn(
                            "mt-1 inline-flex w-max items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.3em]",
                            BADGE_TONE_STYLES[action.badge.tone]
                          )}
                        >
                          {action.badge.label}
                        </span>
                      )}
                    </CommandPrimitive.Item>
                  ))}
                </div>
              </CommandPrimitive.Group>
            )}

            {actionGroups.map((group) => (
              <CommandPrimitive.Group key={group.id} heading={group.title}>
                <div className="mt-2 grid gap-2">
                  {group.actions.map((action) => (
                    <CommandPrimitive.Item
                      key={action.id}
                      value={`${action.label} ${action.description ?? ""} ${action.secondaryLabel ?? ""} ${(action.keywords ?? []).join(" ")}`}
                      onSelect={() => handleSelect(action)}
                      className="flex flex-col rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-neutral-0 transition hover:border-white/20 hover:bg-white/10 data-[selected=true]:border-rw-blue/60 data-[selected=true]:bg-rw-blue/20"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="font-medium">
                            {renderHighlighted(action.label, search)}
                          </span>
                          {action.description && (
                            <span className="text-xs text-neutral-2">
                              {renderHighlighted(action.description, search)}
                            </span>
                          )}
                          {action.secondaryLabel && (
                            <span className="text-[11px] uppercase tracking-[0.3em] text-neutral-3">
                              {renderHighlighted(action.secondaryLabel, search)}
                            </span>
                          )}
                        </div>
                        {action.badge && (
                          <span
                            className={cn(
                              "inline-flex h-min items-center rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.3em]",
                              BADGE_TONE_STYLES[action.badge.tone]
                            )}
                          >
                            {action.badge.label}
                          </span>
                        )}
                      </div>
                    </CommandPrimitive.Item>
                  ))}
                </div>
              </CommandPrimitive.Group>
            ))}

            <CommandPrimitive.Separator className="my-4 h-px bg-white/10" />

            <CommandPrimitive.Group heading={t("search.ikimina.title", "Ikimina search")}>
              <div className="mt-2 space-y-2">
                {loading ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-2">
                    <Loader2 className="h-4 w-4 animate-spin" />{" "}
                    {t("search.ikimina.loading", "Loading ikimina…")}
                  </div>
                ) : error ? (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                  </div>
                ) : (
                  ikimina
                    .filter((item) =>
                      selectedSacco
                        ? item.saccoName?.toLowerCase().includes(selectedSacco.name.toLowerCase())
                        : true
                    )
                    .slice(0, search ? 20 : 12)
                    .map((item) => (
                      <CommandPrimitive.Item
                        key={item.id}
                        value={`${item.name} ${item.code} ${item.status} ${item.saccoName ?? ""}`}
                        onSelect={() => {
                          router.push(`/ikimina/${item.id}`);
                          onOpenChange(false);
                        }}
                        className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-neutral-0 transition hover:border-white/20 hover:bg-white/10 data-[selected=true]:border-rw-blue/60 data-[selected=true]:bg-rw-blue/20"
                      >
                        <div>
                          <p className="font-medium">{renderHighlighted(item.name, search)}</p>
                          <p className="text-xs text-neutral-2">
                            Code · <span className="font-mono text-neutral-1">{item.code}</span>
                            {item.saccoName ? ` • ${item.saccoName}` : ""}
                          </p>
                        </div>
                        <ArrowUpRight className="h-4 w-4 text-neutral-2" aria-hidden />
                      </CommandPrimitive.Item>
                    ))
                )}
              </div>
              <div className="mt-3 text-[10px] uppercase tracking-[0.3em] text-neutral-3">
                {t("search.common.lastSyncedPrefix", "Last synced")} ·{" "}
                {lastSyncedAt ? dateTimeFormatter.format(lastSyncedAt) : "—"}
                {showRefreshBadge && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-rw-blue/20 px-2 py-0.5 text-[9px] uppercase tracking-[0.3em] text-neutral-0">
                    <span className="h-2 w-2 rounded-full bg-rw-yellow" />
                    {t("common.updated", "Updated")}
                  </span>
                )}
              </div>
            </CommandPrimitive.Group>

            <CommandPrimitive.Group heading={t("search.members.title", "Member search")}>
              <div className="mt-2 space-y-2">
                {membersLoading ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-2">
                    <Loader2 className="h-4 w-4 animate-spin" />{" "}
                    {t("search.members.loading", "Loading members…")}
                  </div>
                ) : membersError ? (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {membersError}
                  </div>
                ) : (
                  members
                    .filter((member) =>
                      selectedSacco && member.ikiminaName
                        ? member.ikiminaName
                            .toLowerCase()
                            .includes(selectedSacco.name.toLowerCase())
                        : true
                    )
                    .slice(0, search ? 18 : 12)
                    .map((member) => (
                      <CommandPrimitive.Item
                        key={member.id}
                        value={`${member.fullName} ${member.memberCode ?? ""} ${member.msisdn ?? ""} ${member.ikiminaName ?? ""}`}
                        onSelect={() => {
                          const href = member.ikiminaId
                            ? `/ikimina/${member.ikiminaId}`
                            : "/ikimina";
                          router.push(href);
                          onOpenChange(false);
                        }}
                        className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-neutral-0 transition hover:border-white/20 hover:bg-white/10 data-[selected=true]:border-rw-blue/60 data-[selected=true]:bg-rw-blue/20"
                      >
                        <div>
                          <p className="font-medium">
                            {renderHighlighted(member.fullName, search)}
                          </p>
                          <p className="text-xs text-neutral-2">
                            {member.memberCode ? (
                              <>
                                Code ·{" "}
                                <span className="font-mono text-neutral-1">
                                  {renderHighlighted(member.memberCode, search)}
                                </span>
                              </>
                            ) : (
                              <span>{t("search.members.noCode", "No member code")}</span>
                            )}
                            {member.msisdn && <> • {renderHighlighted(member.msisdn, search)}</>}
                            {member.ikiminaName && <> • {member.ikiminaName}</>}
                          </p>
                        </div>
                        <ArrowUpRight className="h-4 w-4 text-neutral-2" aria-hidden />
                      </CommandPrimitive.Item>
                    ))
                )}
              </div>
            </CommandPrimitive.Group>

            <CommandPrimitive.Group heading={t("search.payments.title", "Recent payments")}>
              <div className="mt-2 space-y-2">
                {paymentsLoading ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-2">
                    <Loader2 className="h-4 w-4 animate-spin" />{" "}
                    {t("search.payments.loading", "Loading payments…")}
                  </div>
                ) : paymentsError ? (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {paymentsError}
                  </div>
                ) : (
                  payments
                    .filter((payment) =>
                      selectedSacco && payment.ikiminaName
                        ? payment.ikiminaName
                            .toLowerCase()
                            .includes(selectedSacco.name.toLowerCase())
                        : true
                    )
                    .slice(0, search ? 15 : 8)
                    .map((payment) => (
                      <CommandPrimitive.Item
                        key={payment.id}
                        value={`${payment.status} ${payment.reference ?? ""} ${payment.ikiminaName ?? ""} ${payment.memberName ?? ""}`}
                        onSelect={() => {
                          const href = payment.ikiminaId
                            ? `/ikimina/${payment.ikiminaId}`
                            : "/recon";
                          router.push(href);
                          onOpenChange(false);
                        }}
                        className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-neutral-0 transition hover:border-white/20 hover:bg-white/10 data-[selected=true]:border-rw-blue/60 data-[selected=true]:bg-rw-blue/20"
                      >
                        <div className="space-y-1">
                          <p className="font-medium">
                            {currencyFormatter.format(payment.amount)} · {payment.status}
                          </p>
                          <p className="text-xs text-neutral-2">
                            {payment.memberName ? `${payment.memberName} • ` : ""}
                            {payment.ikiminaName ?? t("search.payments.noIkimina", "No ikimina")}
                          </p>
                          {payment.reference && (
                            <p className="text-[11px] font-mono text-neutral-2">
                              {renderHighlighted(payment.reference, search)}
                            </p>
                          )}
                          <p className="text-[11px] text-neutral-3">
                            {formatRelativeDate(payment.occurredAt, dateTimeFormatter)} ·{" "}
                            {dateTimeFormatter.format(new Date(payment.occurredAt))}
                          </p>
                        </div>
                        <ArrowUpRight className="h-4 w-4 text-neutral-2" aria-hidden />
                      </CommandPrimitive.Item>
                    ))
                )}
              </div>
            </CommandPrimitive.Group>
          </CommandPrimitive.List>
        </div>
      </div>
    </CommandPrimitive.Dialog>
  );
}

function formatRelativeDate(value: string, formatter: Intl.DateTimeFormat) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) {
    return formatter.format(date);
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? "s" : ""} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;

  return formatter.format(date);
}

function renderHighlighted(text: string, query: string): ReactNode {
  if (!query) return text;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  if (index === -1) return text;
  const before = text.slice(0, index);
  const match = text.slice(index, index + query.length);
  const after = text.slice(index + query.length);
  return (
    <span>
      {before}
      <mark className="rounded bg-white/20 px-1 text-neutral-0">{match}</mark>
      {after}
    </span>
  );
}
