"use client";

import { Bell, Menu, Search } from "lucide-react";
import type { ProfileRow } from "@/lib/auth";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import { OfflineQueueIndicator } from "@/components/system/offline-queue-indicator.ssr-wrapper";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { TenantSwitcher } from "@/components/admin/panel/tenant-switcher";
import type { TenantOption } from "@/components/admin/panel/types";
import { useCommandPalette } from "@/src/components/common/CommandPalette";

interface AdminPanelTopBarProps {
  profile: ProfileRow;
  tenantOptions: TenantOption[];
  alertsCount: number;
  onToggleNav: () => void;
  alertsBreakdown: { approvals: number; reconciliation: number };
}

export function AdminPanelTopBar({
  profile,
  tenantOptions,
  alertsCount,
  onToggleNav,
  alertsBreakdown: _alertsBreakdown,
}: AdminPanelTopBarProps) {
  const { open: paletteOpen, openPalette } = useCommandPalette();

  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-neutral-200/80 bg-white/90 backdrop-blur dark:border-neutral-700/80 dark:bg-neutral-800/90">
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
        <div className="flex items-center gap-3">
          <OfflineQueueIndicator />
          <button
            type="button"
            onClick={onToggleNav}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600 lg:hidden"
            aria-label="Toggle navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
          <TenantSwitcher options={tenantOptions} className="hidden md:flex" />
        </div>
        <div className="flex flex-1 items-center justify-end gap-4">
          <TenantSwitcher options={tenantOptions} className="md:hidden" />
          <OfflineQueueIndicator />
          <button
            type="button"
            onClick={openPalette}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-neutral-300 bg-neutral-100 px-4 py-2.5 text-sm text-neutral-900 shadow-sm transition hover:bg-neutral-200 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600"
            aria-haspopup="dialog"
            aria-expanded={paletteOpen}
            aria-label="Search operations, SACCOs, members, and more"
          >
            <Search className="h-4 w-4" />
            <span className="hidden md:inline">Search</span>
            <kbd className="hidden rounded bg-neutral-200 px-2 py-0.5 text-[10px] font-semibold text-neutral-700 dark:bg-neutral-600 dark:text-neutral-200 md:inline">
              ⌘K
            </kbd>
          </button>
          <div className="relative inline-flex items-center">
            <Bell className="h-5 w-5 text-neutral-600 dark:text-neutral-300" aria-hidden />
            {alertsCount > 0 && (
              <span className="absolute -right-2 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 text-[11px] font-semibold text-neutral-950">
                {alertsCount}
              </span>
            )}
          </div>
          <LanguageSwitcher variant="compact" />
          <div className="hidden items-center gap-2 rounded-full border border-neutral-300 bg-neutral-100 px-3 py-1 text-left dark:border-neutral-600 dark:bg-neutral-700 sm:flex">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-600 dark:text-neutral-400">
                {profile.role}
              </p>
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {profile.email}
              </p>
            </div>
            <div className="h-10 w-px bg-neutral-300 dark:bg-neutral-600" />
            <SignOutButton
              variant="ghost"
              className="text-xs uppercase tracking-[0.3em] text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
