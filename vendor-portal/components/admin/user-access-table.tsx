"use client";

import { useMemo, useTransition } from "react";
import type { Database } from "@/lib/supabase/types";
import { useTranslation } from "@/providers/i18n-provider";
import { useToast } from "@/providers/toast-provider";
import {
  updateUserAccess,
  resetUserPassword,
  toggleUserSuspension,
} from "@/app/(main)/admin/actions";

const ROLES: Array<Database["public"]["Enums"]["app_role"]> = [
  "SYSTEM_ADMIN",
  "SACCO_MANAGER",
  "SACCO_STAFF",
  "SACCO_VIEWER",
  "DISTRICT_MANAGER",
  "MFI_MANAGER",
  "MFI_STAFF",
];

interface AdminUserRow {
  id: string;
  email: string;
  role: Database["public"]["Enums"]["app_role"];
  sacco_id: string | null;
  sacco_name: string | null;
  created_at: string | null;
  suspended?: boolean | null;
}

interface UserAccessTableProps {
  users: AdminUserRow[];
  saccos: Array<{ id: string; name: string }>;
  onView?: (user: AdminUserRow) => void;
}

export function UserAccessTable({ users, saccos, onView }: UserAccessTableProps) {
  const { t } = useTranslation();
  const { success, error } = useToast();
  const [pending, startTransition] = useTransition();

  const saccoOptions = useMemo(
    () => [{ id: "", name: t("sacco.all", "All SACCOs") }, ...saccos],
    [saccos, t]
  );

  const handleUpdate = (
    userId: string,
    role: Database["public"]["Enums"]["app_role"],
    saccoId: string | null
  ) => {
    startTransition(async () => {
      const result = await updateUserAccess({ userId, role, saccoId });
      if (result.status === "error") {
        error(result.message ?? t("common.operationFailed", "Operation failed"));
      } else {
        success(result.message ?? t("admin.users.updated", "User updated"));
      }
    });
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.2em] text-neutral-2">
          <tr>
            <th className="px-4 py-3">{t("common.email", "Email")}</th>
            <th className="px-4 py-3">{t("admin.invite.role", "Role")}</th>
            <th className="px-4 py-3">{t("nav.ikimina", "Ikimina")}</th>
            <th className="px-4 py-3">{t("common.created", "Created")}</th>
            <th className="px-4 py-3">{t("common.security", "Security")}</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-white/5">
              <td className="px-4 py-3 font-medium text-neutral-0">{user.email}</td>
              <td className="px-4 py-3 text-neutral-0">
                <select
                  value={user.role}
                  onChange={(event) => {
                    const nextRole = event.target.value as Database["public"]["Enums"]["app_role"];
                    const isSaccoRole =
                      nextRole === "SACCO_MANAGER" ||
                      nextRole === "SACCO_STAFF" ||
                      nextRole === "SACCO_VIEWER";
                    const nextSacco = isSaccoRole ? user.sacco_id : null;
                    handleUpdate(user.id, nextRole, nextSacco);
                  }}
                  disabled={pending}
                  className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
                >
                  {ROLES.map((value) => (
                    <option key={value} value={value}>
                      {value.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3 text-neutral-0">
                <select
                  value={user.sacco_id ?? ""}
                  onChange={(event) => handleUpdate(user.id, user.role, event.target.value || null)}
                  disabled={
                    pending ||
                    !(
                      user.role === "SACCO_MANAGER" ||
                      user.role === "SACCO_STAFF" ||
                      user.role === "SACCO_VIEWER"
                    )
                  }
                  className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
                >
                  {saccoOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3 text-neutral-2">
                {user.created_at ? new Date(user.created_at).toLocaleString() : "—"}
              </td>
              <td className="px-4 py-3 text-neutral-2">
                <div className="flex flex-col gap-1 text-[11px]">
                  {user.suspended ? (
                    <span className="text-amber-200">
                      {t("admin.users.suspended", "Suspended")}
                    </span>
                  ) : (
                    <span className="text-emerald-200">{t("admin.users.active", "Active")}</span>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        startTransition(async () => {
                          const result = await resetUserPassword({
                            userId: user.id,
                            email: user.email,
                          });
                          if (result.status === "error") {
                            error(
                              result.message ??
                                t("admin.users.resetPasswordFailed", "Password reset failed")
                            );
                          } else {
                            const msg = result.temporaryPassword
                              ? t(
                                  "admin.users.resetPasswordSuccessTemp",
                                  "Password reset. Temporary: "
                                ) + result.temporaryPassword
                              : t("admin.users.resetPasswordSuccess", "Password reset");
                            success(msg);
                          }
                        });
                      }}
                      disabled={pending}
                      className="rounded-full border border-white/15 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-neutral-0 hover:border-white/30"
                    >
                      {t("admin.users.resetPassword", "Reset password")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        startTransition(async () => {
                          const result = await toggleUserSuspension({
                            userId: user.id,
                            suspended: !Boolean(user.suspended),
                          });
                          if (result.status === "error") {
                            error(
                              result.message ?? t("admin.users.suspendFailed", "Operation failed")
                            );
                          } else {
                            success(result.message ?? t("admin.users.suspendSuccess", "Updated"));
                          }
                        });
                      }}
                      disabled={pending}
                      className="rounded-full border border-white/15 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-neutral-0 hover:border-white/30"
                    >
                      {user.suspended
                        ? t("admin.users.activate", "Activate")
                        : t("admin.users.suspend", "Suspend")}
                    </button>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-neutral-2">
                <button
                  type="button"
                  onClick={() => onView?.(user)}
                  className="rounded-full border border-white/15 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-neutral-0 hover:border-white/30"
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
