"use client";

import { useEffect, useState, useTransition } from "react";
import type { Database } from "@/lib/supabase/types";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  SaccoSearchCombobox,
  type SaccoSearchResult,
} from "@/components/saccos/sacco-search-combobox";
import { OrgSearchCombobox, type OrgSearchResult } from "@/components/admin/org-search-combobox";
import { UserAccessTable } from "@/components/admin/user-access-table";
import { StaffDetail, type StaffRow } from "@/components/admin/staff/staff-detail";

type AppRole = Database["public"]["Enums"]["app_role"];

interface StaffDirectoryProps {
  initialUsers: StaffRow[];
  saccos: Array<{ id: string; name: string }>;
}

export function StaffDirectory({ initialUsers, saccos }: StaffDirectoryProps) {
  const [users, setUsers] = useState<StaffRow[]>(initialUsers);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<AppRole | "">("");
  const [status, setStatus] = useState<"" | "active" | "suspended">("");
  const [orgType, setOrgType] = useState<"" | "SACCO" | "MFI" | "DISTRICT">("");
  const [sacco, setSacco] = useState<SaccoSearchResult | null>(null);
  const [org, setOrg] = useState<OrgSearchResult | null>(null);
  const [_pending, startTransition] = useTransition();
  const [detail, setDetail] = useState<StaffRow | null>(null);

  useEffect(() => {
    setSacco(null);
    setOrg(null);
  }, [orgType]);

  const fetchUsers = () => {
    startTransition(async () => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (role) params.set("role", role);
      if (status) params.set("status", status);
      if (orgType === "SACCO" && sacco?.id) params.set("sacco_id", sacco.id);
      if (orgType === "MFI" || orgType === "DISTRICT") {
        params.set("org_type", orgType);
        if (org?.id) params.set("org_id", org.id);
      }
      const url = `/api/admin/staff${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = (await res.json()) as { users: StaffRow[] };
      setUsers(data.users ?? []);
    });
  };

  useEffect(() => {
    const handle = setTimeout(fetchUsers, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, role, status, sacco?.id, orgType, org?.id]);

  const ROLES: AppRole[] = [
    "SYSTEM_ADMIN",
    "SACCO_MANAGER",
    "SACCO_STAFF",
    "SACCO_VIEWER",
    "DISTRICT_MANAGER",
    "MFI_MANAGER",
    "MFI_STAFF",
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-5">
        <Input
          label="Search"
          placeholder="Search email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value as AppRole | "")}
          options={["", ...ROLES]}
          emptyLabel="All"
        />
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          options={["", "active", "suspended"]}
          emptyLabel="All"
        />
        <Select
          label="Org Type"
          value={orgType}
          onChange={(e) => setOrgType(e.target.value as any)}
          options={["", "SACCO", "MFI", "DISTRICT"]}
          emptyLabel="All"
        />
        <div>
          {orgType === "SACCO" && <SaccoSearchCombobox value={sacco} onChange={setSacco} />}
          {orgType === "MFI" && <OrgSearchCombobox type="MFI" value={org} onChange={setOrg} />}
          {orgType === "DISTRICT" && (
            <OrgSearchCombobox type="DISTRICT" value={org} onChange={setOrg} />
          )}
        </div>
      </div>

      <UserAccessTable
        users={users as any}
        saccos={saccos}
        onView={(u) => {
          setDetail(u as any);
        }}
      />

      {detail && (
        <StaffDetail
          user={detail}
          saccos={saccos}
          onClose={() => setDetail(null)}
          onUpdated={fetchUsers}
        />
      )}
    </div>
  );
}
