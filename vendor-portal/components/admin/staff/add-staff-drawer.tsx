"use client";

import { useState, useTransition } from "react";
import { Trans } from "@/components/common/trans";
import { useTranslation } from "@/providers/i18n-provider";
import { useToast } from "@/providers/toast-provider";
import { Drawer } from "@/components/ui/drawer";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

interface Organization {
  id: string;
  name: string;
  type: string;
}

interface AddStaffDrawerTriggerProps {
  organizations: Organization[];
}

const ROLES: Array<Database["public"]["Enums"]["app_role"]> = [
  "SYSTEM_ADMIN",
  "DISTRICT_MANAGER",
  "MFI_MANAGER",
  "MFI_STAFF",
  "SACCO_MANAGER",
  "SACCO_STAFF",
  "SACCO_VIEWER",
];

export function AddStaffDrawerTrigger({ organizations }: AddStaffDrawerTriggerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="interactive-scale rounded-xl bg-kigali px-4 py-2 text-sm font-semibold text-ink shadow-glass hover:bg-kigali/90"
      >
        <Trans i18nKey="admin.staff.addStaff" fallback="Add staff" />
      </button>

      <AddStaffDrawer
        open={isOpen}
        organizations={organizations}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}

interface AddStaffDrawerProps {
  organizations: Organization[];
  open: boolean;
  onClose: () => void;
}

function AddStaffDrawer({ organizations, open, onClose }: AddStaffDrawerProps) {
  const { t } = useTranslation();
  const { success, error: toastError } = useToast();
  const supabase = getSupabaseBrowserClient();
  const [pending, startTransition] = useTransition();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Database["public"]["Enums"]["app_role"]>("SACCO_STAFF");
  const [selectedOrg, setSelectedOrg] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const generateRandomPassword = () => {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      password += charset[array[i] % charset.length];
    }
    setGeneratedPassword(password);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (role !== "SYSTEM_ADMIN" && !selectedOrg) {
      const msg = t("admin.staff.selectOrg", "Select an organization for this role");
      setError(msg);
      toastError(msg);
      return;
    }

    if (!generatedPassword) {
      const msg = t("admin.staff.generatePassword", "Generate a password first");
      setError(msg);
      toastError(msg);
      return;
    }

    startTransition(async () => {
      const { error: inviteError } = await supabase.functions.invoke("admin-invite-staff", {
        body: {
          email,
          fullName: fullName || null,
          phone: phone || null,
          role,
          orgId: role === "SYSTEM_ADMIN" ? null : selectedOrg || null,
          temporaryPassword: generatedPassword,
        },
      });

      if (inviteError) {
        console.error(inviteError);
        const msg = inviteError.message ?? t("admin.staff.inviteFailed", "Failed to invite staff");
        setError(msg);
        toastError(msg);
        return;
      }

      success(t("admin.staff.inviteSuccess", "Staff invitation sent successfully"));
      onClose();
      // Refresh the page to show new staff
      window.location.reload();
    });
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="lg"
      title={<Trans i18nKey="admin.staff.addNewStaff" fallback="Add new staff" />}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-neutral-2 space-y-2">
          <p>
            <Trans
              i18nKey="admin.staff.inviteHelper1"
              fallback="New staff will receive an email with their temporary password and must reset it on first login."
            />
          </p>
          <p>
            <Trans
              i18nKey="admin.staff.inviteHelper2"
              fallback="Assign appropriate roles based on their responsibilities."
            />
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs uppercase tracking-[0.3em] text-neutral-2 mb-2">
              <Trans i18nKey="common.email" fallback="Email" />*
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 placeholder:text-neutral-2 focus:outline-none focus:ring-2 focus:ring-rw-blue"
              placeholder="staff@example.com"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-[0.3em] text-neutral-2 mb-2">
              <Trans i18nKey="admin.staff.fullName" fallback="Full name" />
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 placeholder:text-neutral-2 focus:outline-none focus:ring-2 focus:ring-rw-blue"
              placeholder={t("admin.staff.fullNamePlaceholder", "John Doe")}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-[0.3em] text-neutral-2 mb-2">
            <Trans i18nKey="admin.staff.phone" fallback="Phone" />
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 placeholder:text-neutral-2 focus:outline-none focus:ring-2 focus:ring-rw-blue"
            placeholder="+250..."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs uppercase tracking-[0.3em] text-neutral-2 mb-2">
              <Trans i18nKey="admin.staff.role" fallback="Role" />*
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          {role !== "SYSTEM_ADMIN" && (
            <div>
              <label className="block text-xs uppercase tracking-[0.3em] text-neutral-2 mb-2">
                <Trans i18nKey="admin.staff.organization" fallback="Organization" />*
              </label>
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
                required
              >
                <option value="">
                  {t("admin.staff.selectOrganization", "Select organization")}
                </option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.type})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs uppercase tracking-[0.3em] text-neutral-2 mb-2">
            <Trans i18nKey="admin.staff.temporaryPassword" fallback="Temporary password" />*
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={generatedPassword}
              onChange={(e) => setGeneratedPassword(e.target.value)}
              className="flex-1 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 font-mono focus:outline-none focus:ring-2 focus:ring-rw-blue"
              placeholder={t("admin.staff.clickGenerate", "Click generate →")}
              required
            />
            <button
              type="button"
              onClick={generateRandomPassword}
              className="interactive-scale rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-neutral-0 hover:bg-white/20"
            >
              <Trans i18nKey="admin.staff.generate" fallback="Generate" />
            </button>
          </div>
          {generatedPassword && (
            <p className="mt-2 text-xs text-neutral-3">
              <Trans
                i18nKey="admin.staff.passwordNote"
                fallback="⚠️ Save this password securely - it will be sent to the user via email."
              />
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-neutral-0 hover:bg-white/10"
          >
            <Trans i18nKey="common.cancel" fallback="Cancel" />
          </button>
          <button
            type="submit"
            disabled={pending}
            className="interactive-scale flex-1 rounded-xl bg-kigali px-4 py-3 text-sm font-semibold uppercase tracking-wide text-ink shadow-glass disabled:pointer-events-none disabled:opacity-60"
          >
            {pending ? (
              <Trans i18nKey="common.sending" fallback="Sending..." />
            ) : (
              <Trans i18nKey="admin.staff.sendInvite" fallback="Send invite" />
            )}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
