"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabaseAuth } from "@/components/providers/SupabaseAuthProvider";
import { SectionCard } from "@/components/ui/SectionCard";
import { useToast } from "@/components/ui/ToastProvider";

interface InviteUserResponse {
  status: string;
  userId: string | null;
  role: string;
}

async function postInvite(payload: { email: string; role: "admin" | "staff" }) {
  const response = await fetch("/api/users/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof json?.message === "string" ? json.message : "Failed to send invite.";
    throw new Error(message);
  }
  return json as InviteUserResponse;
}

export function InviteUserCard() {
  const queryClient = useQueryClient();
  const { status, isAdmin } = useSupabaseAuth();
  const { pushToast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "staff">("admin");

  const inviteMutation = useMutation({
    mutationFn: () => postInvite({ email, role }),
    onSuccess: (result) => {
      pushToast({
        title: "Invite sent",
        description:
          result.userId
            ? `Invite sent to ${email}. Role set to ${result.role}.`
            : `Invite sent to ${email}.`,
        tone: "success",
      });
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["users"] }).catch(() => undefined);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unable to send invite.";
      pushToast({ title: "Invite failed", description: message, tone: "error" });
    },
  });

  const disabledReason = useMemo(() => {
    if (status === "loading") return "Checking permissions";
    if (!isAdmin) return "Admin access required";
    if (!email.trim()) return "Enter an email";
    return null;
  }, [email, isAdmin, status]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabledReason) return;
    inviteMutation.mutate();
  };

  return (
    <SectionCard
      title="Invite user"
      description="Send a Supabase invite email and assign the admin role."
    >
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm" htmlFor="invite-email">
          Email
          <input
            id="invite-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={inviteMutation.isPending || status !== "authenticated" || !isAdmin}
            className="rounded-md border border-neutral-300 px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm" htmlFor="invite-role">
          Role
          <select
            id="invite-role"
            value={role}
            onChange={(event) => setRole(event.target.value as "admin" | "staff")}
            disabled={inviteMutation.isPending || status !== "authenticated" || !isAdmin}
            className="rounded-md border border-neutral-300 px-3 py-2 text-base"
          >
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
          </select>
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={Boolean(disabledReason) || inviteMutation.isPending}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            {inviteMutation.isPending ? "Sending invite…" : "Send invite"}
          </button>
          {disabledReason && (
            <span className="text-sm text-neutral-500">{disabledReason}</span>
          )}
        </div>
      </form>
    </SectionCard>
  );
}
