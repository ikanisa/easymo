"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Trans } from "@/components/common/trans";
import { useTranslation } from "@/providers/i18n-provider";

interface Organization {
  id: string;
  name: string;
  type: string;
}

interface StaffFiltersProps {
  organizations: Organization[];
  currentOrgType: string;
  currentRole: string;
  currentStatus: string;
}

const ORG_TYPES = ["SACCO", "MFI", "DISTRICT"];
const ROLES = [
  "SYSTEM_ADMIN",
  "DISTRICT_MANAGER",
  "MFI_MANAGER",
  "MFI_STAFF",
  "SACCO_MANAGER",
  "SACCO_STAFF",
  "SACCO_VIEWER",
];
const STATUSES = ["ACTIVE", "SUSPENDED", "INACTIVE"];

export function StaffFilters({ currentOrgType, currentRole, currentStatus }: StaffFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div>
        <label className="block text-xs uppercase tracking-[0.3em] text-neutral-2 mb-2">
          <Trans i18nKey="admin.staff.filters.orgType" fallback="Organization type" />
        </label>
        <select
          value={currentOrgType}
          onChange={(e) => updateFilter("org_type", e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
        >
          <option value="">{t("admin.staff.filters.allOrgTypes", "All types")}</option>
          {ORG_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-[0.3em] text-neutral-2 mb-2">
          <Trans i18nKey="admin.staff.filters.role" fallback="Role" />
        </label>
        <select
          value={currentRole}
          onChange={(e) => updateFilter("role", e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
        >
          <option value="">{t("admin.staff.filters.allRoles", "All roles")}</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-[0.3em] text-neutral-2 mb-2">
          <Trans i18nKey="admin.staff.filters.status" fallback="Status" />
        </label>
        <select
          value={currentStatus}
          onChange={(e) => updateFilter("status", e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
        >
          <option value="">{t("admin.staff.filters.allStatuses", "All statuses")}</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
