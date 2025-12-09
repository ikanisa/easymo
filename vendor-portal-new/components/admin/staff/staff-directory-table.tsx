"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusChip } from "@/components/common/status-chip";
import { Trans } from "@/components/common/trans";
import { useTranslation } from "@/providers/i18n-provider";

export interface StaffMember {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  sacco_id: string | null;
  account_status: string;
  pw_reset_required: boolean;
  last_login_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  sacco: {
    id: string;
    name: string | null;
    district: string | null;
    status: string | null;
  } | null;
  org_memberships: Array<{
    org_id: string;
    role: string;
    org_name: string;
    org_type: string;
  }>;
}

interface StaffDirectoryTableProps {
  staff: StaffMember[];
}

export function StaffDirectoryTable({ staff }: StaffDirectoryTableProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  const filteredStaff = staff.filter((member) => {
    const searchLower = search.toLowerCase();
    return (
      member.email.toLowerCase().includes(searchLower) ||
      member.full_name?.toLowerCase().includes(searchLower) ||
      member.role.toLowerCase().includes(searchLower)
    );
  });

  if (staff.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-neutral-2">
        <Trans i18nKey="admin.staff.noStaff" fallback="No staff members found." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <input
          type="text"
          placeholder={t("admin.staff.search", "Search by name, email, or role...")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-neutral-0 placeholder:text-neutral-2 focus:outline-none focus:ring-2 focus:ring-rw-blue"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.3em] text-neutral-2">
              <th className="pb-3">
                <Trans i18nKey="admin.staff.table.name" fallback="Name" />
              </th>
              <th className="pb-3">
                <Trans i18nKey="admin.staff.table.email" fallback="Email" />
              </th>
              <th className="pb-3">
                <Trans i18nKey="admin.staff.table.role" fallback="Role" />
              </th>
              <th className="pb-3">
                <Trans i18nKey="admin.staff.table.organization" fallback="Organization" />
              </th>
              <th className="pb-3">
                <Trans i18nKey="admin.staff.table.status" fallback="Status" />
              </th>
              <th className="pb-3">
                <Trans i18nKey="admin.staff.table.lastLogin" fallback="Last login" />
              </th>
              <th className="pb-3">
                <Trans i18nKey="admin.staff.table.actions" fallback="Actions" />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredStaff.map((member) => (
              <tr key={member.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-4">
                  <div className="font-medium text-neutral-0">
                    {member.full_name || t("admin.staff.noName", "—")}
                  </div>
                  {member.phone && <div className="text-xs text-neutral-3">{member.phone}</div>}
                </td>
                <td className="py-4 text-neutral-1">{member.email}</td>
                <td className="py-4">
                  <span className="rounded-lg bg-white/10 px-2 py-1 text-xs font-medium text-neutral-0">
                    {member.role.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="py-4 text-neutral-1">
                  {member.sacco ? (
                    <div>
                      <div className="font-medium">{member.sacco.name}</div>
                      <div className="text-xs text-neutral-3">{member.sacco.district}</div>
                    </div>
                  ) : member.org_memberships.length > 0 ? (
                    <div>
                      {member.org_memberships.map((om, idx) => (
                        <div key={idx} className="text-xs">
                          {om.org_name} ({om.org_type})
                        </div>
                      ))}
                    </div>
                  ) : (
                    t("admin.staff.noOrg", "—")
                  )}
                </td>
                <td className="py-4">
                  <div className="flex flex-col gap-1">
                    <StatusChip
                      tone={
                        member.account_status === "ACTIVE"
                          ? "success"
                          : member.account_status === "SUSPENDED"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {member.account_status}
                    </StatusChip>
                    {member.pw_reset_required && (
                      <StatusChip tone="info">
                        <Trans i18nKey="admin.staff.resetRequired" fallback="Reset required" />
                      </StatusChip>
                    )}
                  </div>
                </td>
                <td className="py-4 text-neutral-2">
                  {member.last_login_at
                    ? new Date(member.last_login_at).toLocaleDateString()
                    : t("admin.staff.neverLoggedIn", "Never")}
                </td>
                <td className="py-4">
                  <Link
                    href={`/admin/staff/${member.id}`}
                    className="interactive-scale rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-neutral-0 hover:bg-white/20"
                  >
                    <Trans i18nKey="admin.staff.viewDetails" fallback="View" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredStaff.length === 0 && search && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center text-neutral-2">
          <Trans i18nKey="admin.staff.noResults" fallback="No staff members match your search." />
        </div>
      )}
    </div>
  );
}
