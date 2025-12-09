"use client";

import { useEffect, useState, useTransition } from "react";
import type { Database } from "@/lib/supabase/types";
import { useToast } from "@/providers/toast-provider";
import { resetUserPassword, toggleUserSuspension } from "@/app/(main)/admin/actions";
import {
  SaccoSearchCombobox,
  type SaccoSearchResult,
} from "@/components/saccos/sacco-search-combobox";
import { OrgSearchCombobox, type OrgSearchResult } from "@/components/admin/org-search-combobox";
import { Drawer } from "@/components/ui/drawer";

type AppRole = Database["public"]["Enums"]["app_role"];

const resolveOrgTypeFromRole = (role: AppRole): "SACCO" | "MFI" | "DISTRICT" => {
  if (role === "DISTRICT_MANAGER") return "DISTRICT";
  if (role === "MFI_MANAGER" || role === "MFI_STAFF") return "MFI";
  return "SACCO";
};

export interface StaffRow {
  id: string;
  email: string;
  role: AppRole;
  sacco_id: string | null;
  sacco_name: string | null;
  suspended?: boolean | null;
  created_at?: string | null;
}

interface StaffDetailProps {
  user: StaffRow;
  saccos: Array<{ id: string; name: string }>;
  onClose: () => void;
  onUpdated?: () => void;
  open?: boolean;
}

export function StaffDetail({
  user,
  saccos: _saccos,
  onClose,
  onUpdated,
  open = true,
}: StaffDetailProps) {
  const [pending, startTransition] = useTransition();
  const { success, error } = useToast();
  const [role, setRole] = useState<AppRole>(user.role);
  const [sacco, setSacco] = useState<SaccoSearchResult | null>(
    user.sacco_id
      ? { id: user.sacco_id, name: user.sacco_name ?? "", district: "", province: "", category: "" }
      : null
  );
  const [org, setOrg] = useState<OrgSearchResult | null>(null);
  const [memberships, setMemberships] = useState<
    Array<{
      org_id: string;
      role: AppRole;
      created_at?: string | null;
      organizations?: { name?: string | null; type?: string | null } | null;
    }>
  >([]);
  const [membershipType, setMembershipType] = useState<"SACCO" | "MFI" | "DISTRICT">(
    resolveOrgTypeFromRole(user.role)
  );
  const [membershipRole, setMembershipRole] = useState<AppRole>(user.role);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/staff/memberships?user_id=${encodeURIComponent(user.id)}`
        );
        if (!active) return;
        if (res.ok) {
          const data = (await res.json()) as { memberships: typeof memberships };
          const list = data.memberships ?? [];
          setMemberships(list);
          const targetType = resolveOrgTypeFromRole(user.role);
          if (targetType !== "SACCO") {
            setOrg((current) => {
              if (current) return current;
              const match = list.find((m) => (m.organizations?.type ?? null) === targetType);
              if (!match) return current;
              return { id: match.org_id, name: match.organizations?.name ?? match.org_id };
            });
          }
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      active = false;
    };
  }, [user.id, user.role]);

  useEffect(() => {
    setMembershipType(resolveOrgTypeFromRole(role));
    if (!(role === "DISTRICT_MANAGER" || role === "MFI_MANAGER" || role === "MFI_STAFF")) {
      setOrg(null);
    }
  }, [role]);

  const ROLES: AppRole[] = [
    "SYSTEM_ADMIN",
    "SACCO_MANAGER",
    "SACCO_STAFF",
    "SACCO_VIEWER",
    "DISTRICT_MANAGER",
    "MFI_MANAGER",
    "MFI_STAFF",
  ];

  const assignRole = () => {
    startTransition(async () => {
      try {
        const body: Record<string, unknown> = { user_id: user.id, role };
        const isSaccoRole =
          role === "SACCO_MANAGER" || role === "SACCO_STAFF" || role === "SACCO_VIEWER";
        if (isSaccoRole) body.sacco_id = sacco?.id ?? null;
        // For other org types, use /api/admin/staff/assign-role (org_memberships upsert inside)
        const res = await fetch("/api/admin/staff/assign-role", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isSaccoRole ? body : { ...body, sacco_id: null, org_id: org?.id ?? null }
          ),
        });
        if (!res.ok) {
          const { error: msg } = await res.json().catch(() => ({ error: "Update failed" }));
          error(String(msg ?? "Update failed"));
          return;
        }
        success("Access updated");
        onUpdated?.();
      } catch {
        error("Update failed");
      }
    });
  };

  const doResetPassword = () => {
    startTransition(async () => {
      const result = await resetUserPassword({ userId: user.id, email: user.email });
      if (result.status === "error") {
        error(result.message ?? "Reset failed");
      } else {
        success(
          result.temporaryPassword
            ? `Temporary password: ${result.temporaryPassword}`
            : "Password reset"
        );
      }
    });
  };

  const doToggleSuspend = () => {
    startTransition(async () => {
      const result = await toggleUserSuspension({
        userId: user.id,
        suspended: !Boolean(user.suspended),
      });
      if (result.status === "error") {
        error(result.message ?? "Operation failed");
      } else {
        success(result.message ?? "Updated");
        onUpdated?.();
      }
    });
  };

  const addMembership = () => {
    startTransition(async () => {
      try {
        const orgId = membershipType === "SACCO" ? sacco?.id : org?.id;
        if (!orgId) {
          error("Please select an organization");
          return;
        }
        const res = await fetch("/api/admin/staff/assign-role", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: user.id,
            role: membershipRole,
            sacco_id: membershipType === "SACCO" ? orgId : null,
            org_id: membershipType !== "SACCO" ? orgId : null,
          }),
        });
        if (!res.ok) {
          const { error: msg } = await res
            .json()
            .catch(() => ({ error: "Failed to add membership" }));
          error(String(msg ?? "Failed to add membership"));
          return;
        }
        success("Membership added");
        onUpdated?.();
      } catch {
        error("Failed to add membership");
      }
    });
  };

  const isSaccoRoleSel =
    role === "SACCO_MANAGER" || role === "SACCO_STAFF" || role === "SACCO_VIEWER";
  const isDistrictRoleSel = role === "DISTRICT_MANAGER";
  const isMfiRoleSel = role === "MFI_MANAGER" || role === "MFI_STAFF";

  return (
    <Drawer open={open} onClose={onClose} size="lg" title="Staff Detail" className="bg-neutral-950">
      <div className="space-y-5 text-sm text-neutral-0">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-neutral-2">Email</div>
          <div className="break-words text-neutral-0">{user.email}</div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-neutral-2">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AppRole)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-neutral-0"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-neutral-2">Status</label>
            <div className="mt-2 text-neutral-0">{user.suspended ? "Suspended" : "Active"}</div>
          </div>
        </div>

        {isSaccoRoleSel && <SaccoSearchCombobox value={sacco} onChange={setSacco} />}
        {isDistrictRoleSel && <OrgSearchCombobox type="DISTRICT" value={org} onChange={setOrg} />}
        {isMfiRoleSel && <OrgSearchCombobox type="MFI" value={org} onChange={setOrg} />}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={assignRole}
            disabled={pending}
            className="rounded-xl bg-kigali px-4 py-2 text-sm font-semibold text-ink shadow-glass"
          >
            Save
          </button>
          <button
            onClick={doResetPassword}
            disabled={pending}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm text-neutral-0"
          >
            Reset password
          </button>
          <button
            onClick={doToggleSuspend}
            disabled={pending}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm text-neutral-0"
          >
            {user.suspended ? "Activate" : "Suspend"}
          </button>
        </div>

        <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <header className="flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-[0.3em] text-neutral-2">Org memberships</h3>
          </header>
          <ul className="space-y-2 text-sm text-neutral-0">
            {memberships.length === 0 ? (
              <li className="text-neutral-2">None</li>
            ) : (
              memberships.map((m) => (
                <li
                  key={`${m.org_id}-${m.role}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2"
                >
                  <div className="space-y-1 text-left">
                    <p className="font-medium">{(m.organizations?.name ?? m.org_id).toString()}</p>
                    <p className="text-[11px] uppercase tracking-[0.25em] text-neutral-3">
                      {(m.organizations?.type ?? "").toString()} · {m.role.replace(/_/g, " ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch(
                        `/api/admin/staff/memberships?user_id=${encodeURIComponent(user.id)}&org_id=${encodeURIComponent(m.org_id)}`,
                        { method: "DELETE" }
                      );
                      const res = await fetch(
                        `/api/admin/staff/memberships?user_id=${encodeURIComponent(user.id)}`
                      );
                      if (res.ok) {
                        const data = (await res.json()) as { memberships: typeof memberships };
                        setMemberships(data.memberships ?? []);
                        onUpdated?.();
                      }
                    }}
                    className="rounded-lg border border-white/15 px-2 py-1 text-xs text-neutral-0 transition hover:border-white/30 hover:text-white"
                  >
                    Remove
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <header>
            <h3 className="text-xs uppercase tracking-[0.3em] text-neutral-2">Add membership</h3>
          </header>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.3em] text-neutral-2">Type</label>
              <select
                value={membershipType}
                onChange={(e) => setMembershipType(e.target.value as typeof membershipType)}
                className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0"
              >
                <option value="SACCO">SACCO</option>
                <option value="MFI">MFI</option>
                <option value="DISTRICT">District</option>
              </select>
              <label className="text-xs uppercase tracking-[0.3em] text-neutral-2">Role</label>
              <select
                value={membershipRole}
                onChange={(e) => setMembershipRole(e.target.value as AppRole)}
                className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0"
              >
                {(ROLES as AppRole[])
                  .filter((r) => resolveOrgTypeFromRole(r) === membershipType)
                  .map((r) => (
                    <option key={r} value={r}>
                      {r.replace(/_/g, " ")}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              {membershipType === "SACCO" && (
                <SaccoSearchCombobox value={sacco} onChange={setSacco} />
              )}
              {membershipType === "MFI" && (
                <OrgSearchCombobox type="MFI" value={org} onChange={setOrg} />
              )}
              {membershipType === "DISTRICT" && (
                <OrgSearchCombobox type="DISTRICT" value={org} onChange={setOrg} />
              )}
              <button
                onClick={addMembership}
                disabled={pending}
                className="w-full rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-neutral-0"
              >
                Add membership
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-neutral-0">
          <header>
            <h3 className="text-xs uppercase tracking-[0.3em] text-red-200">Danger zone</h3>
          </header>
          <div className="space-y-2 text-sm">
            <button
              onClick={doResetPassword}
              disabled={pending}
              className="w-full rounded-xl border border-white/15 px-4 py-2 text-sm text-neutral-0"
            >
              Send password reset email
            </button>
            <button
              onClick={doToggleSuspend}
              disabled={pending}
              className="w-full rounded-xl border border-red-400/40 px-4 py-2 text-sm text-red-200"
            >
              {user.suspended ? "Unsuspend user" : "Suspend user"}
            </button>
          </div>
        </section>
      </div>
    </Drawer>
  );
}
