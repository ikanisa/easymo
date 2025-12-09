"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck, RefreshCcw, ShieldCheck, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminPanelShortcutDetail } from "@/components/admin/panel/shortcuts";
import {
  decideJoinRequest,
  resendInvite,
  revokeInvite,
  sendInvite,
} from "@/app/(main)/admin/(panel)/approvals/actions";
import type { ApprovalActionResult } from "@/app/(main)/admin/(panel)/approvals/actions";
import { cn } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";
import { Skeleton } from "@/components/ui/skeleton";

export interface JoinRequestItem {
  id: string;
  created_at: string | null;
  status: string | null;
  note: string | null;
  user_id: string | null;
  user_email: string | null;
  group_name: string | null;
  sacco_id: string | null;
}

export interface InviteItem {
  id: string;
  created_at: string | null;
  status: string | null;
  invitee_msisdn: string | null;
  group_name: string | null;
  sacco_id: string | null;
}

interface AdminApprovalsPanelProps {
  joinRequests: JoinRequestItem[];
  invites: InviteItem[];
}

export function AdminApprovalsPanel({
  joinRequests: initialJoinRequests,
  invites: initialInvites,
}: AdminApprovalsPanelProps) {
  const router = useRouter();
  const [joinRequests, setJoinRequests] = useState(initialJoinRequests);
  const [invites, setInvites] = useState(initialInvites);
  useEffect(() => setJoinRequests(initialJoinRequests), [initialJoinRequests]);
  const optimisticInviteRef = useRef<{ id: string; msisdn: string; group: string } | null>(null);
  useEffect(() => {
    setInvites(initialInvites);
    if (!optimisticInviteRef.current) {
      return;
    }
    const { id, msisdn, group } = optimisticInviteRef.current;
    const replacement = initialInvites.find((invite) => {
      const msisdnMatch = invite.invitee_msisdn === msisdn;
      const groupMatch = group ? invite.group_name === group : true;
      return msisdnMatch && groupMatch;
    });
    if (replacement) {
      setRequestedInviteId(replacement.id);
      optimisticInviteRef.current = null;
      return;
    }
    if (!initialInvites.some((invite) => invite.id === id)) {
      optimisticInviteRef.current = null;
    }
  }, [initialInvites]);
  const [requestedJoinId, setRequestedJoinId] = useState<string | null>(
    initialJoinRequests[0]?.id ?? null
  );
  const [requestedInviteId, setRequestedInviteId] = useState<string | null>(
    initialInvites[0]?.id ?? null
  );
  const [pendingAction, startTransition] = useTransition();
  const { success, error } = useToast();
  const [inviteGroup, setInviteGroup] = useState("");
  const [inviteMsisdn, setInviteMsisdn] = useState("");

  const pending = pendingAction;

  const selectedJoin = useMemo(() => {
    if (joinRequests.length === 0) return null;
    if (requestedJoinId && joinRequests.some((request) => request.id === requestedJoinId)) {
      return requestedJoinId;
    }
    return joinRequests[0]?.id ?? null;
  }, [joinRequests, requestedJoinId]);

  const selectedInvite = useMemo(() => {
    if (invites.length === 0) return null;
    if (requestedInviteId && invites.some((invite) => invite.id === requestedInviteId)) {
      return requestedInviteId;
    }
    return invites[0]?.id ?? null;
  }, [invites, requestedInviteId]);

  const handleResult = useCallback(
    (result: ApprovalActionResult, successMessage: string) => {
      if (result.status === "error") {
        error(result.message ?? "Operation failed");
        return false;
      }
      success(successMessage);
      return true;
    },
    [error, success]
  );

  const resolveJoinRequest = useCallback(
    (decision: "approved" | "rejected") => {
      if (!selectedJoin) return;
      const optimistic = joinRequests.find((request) => request.id === selectedJoin);
      if (!optimistic) return;
      setJoinRequests((current) => current.filter((request) => request.id !== selectedJoin));
      startTransition(async () => {
        const result = await decideJoinRequest({ requestId: selectedJoin, decision });
        const ok = handleResult(
          result,
          decision === "approved" ? "Join request approved" : "Join request rejected"
        );
        if (!ok) {
          setJoinRequests((current) => [optimistic, ...current]);
          return;
        }
        router.refresh();
      });
    },
    [handleResult, joinRequests, router, selectedJoin]
  );

  const handleInviteAction = useCallback(
    (type: "resend" | "revoke") => {
      if (!selectedInvite) return;
      const optimistic = invites.find((invite) => invite.id === selectedInvite);
      if (!optimistic) return;
      setInvites((current) => current.filter((invite) => invite.id !== selectedInvite));
      startTransition(async () => {
        const action = type === "resend" ? resendInvite : revokeInvite;
        const result = await action({ inviteId: selectedInvite });
        const ok = handleResult(result, type === "resend" ? "Invite resent" : "Invite revoked");
        if (!ok) {
          setInvites((current) => [optimistic, ...current]);
          return;
        }
        router.refresh();
      });
    },
    [handleResult, invites, router, selectedInvite]
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<AdminPanelShortcutDetail>).detail;
      if (!detail) return;
      if (detail.action === "approve") {
        resolveJoinRequest("approved");
      } else if (detail.action === "reject") {
        resolveJoinRequest("rejected");
      } else if (detail.action === "merge") {
        handleInviteAction("resend");
      }
    };

    window.addEventListener("admin-panel:shortcut", handler as EventListener);
    return () => window.removeEventListener("admin-panel:shortcut", handler as EventListener);
  }, [resolveJoinRequest, handleInviteAction]);

  const submitInvite = useCallback(() => {
    if (!inviteGroup || !inviteMsisdn) {
      error("Group ID and MSISDN are required");
      return;
    }
    const optimisticInvite: InviteItem = {
      id: `temp-${Date.now()}`,
      created_at: new Date().toISOString(),
      status: "pending",
      invitee_msisdn: inviteMsisdn,
      group_name: inviteGroup,
      sacco_id: null,
    };
    setInvites((current) => [optimisticInvite, ...current]);
    setRequestedInviteId(optimisticInvite.id);
    optimisticInviteRef.current = {
      id: optimisticInvite.id,
      msisdn: inviteMsisdn,
      group: inviteGroup,
    };
    startTransition(async () => {
      const result = await sendInvite({ groupId: inviteGroup, msisdn: inviteMsisdn });
      const ok = handleResult(result, "Invite queued");
      if (!ok) {
        setInvites((current) => current.filter((invite) => invite.id !== optimisticInvite.id));
        if (optimisticInviteRef.current?.id === optimisticInvite.id) {
          optimisticInviteRef.current = null;
        }
        return;
      }
      if (result.status === "success") {
        setInviteMsisdn("");
        router.refresh();
      }
    });
  }, [error, handleResult, inviteGroup, inviteMsisdn, router]);

  return (
    <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
      <section className="space-y-4">
        <header>
          <h2 className="text-lg font-semibold text-neutral-0">Join requests</h2>
          <p className="text-xs text-neutral-3">
            Approve or reject pending requests. Keyboard shortcuts: A approve, R reject.
          </p>
        </header>
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <ul className="divide-y divide-white/5">
            {pending && (
              <li className="px-4 py-3">
                <Skeleton className="h-12 w-full rounded-xl bg-white/10" />
              </li>
            )}
            {joinRequests.map((request) => {
              const isSelected = selectedJoin === request.id;
              return (
                <li
                  key={request.id}
                  className={cn(
                    "cursor-pointer bg-white/0 transition",
                    isSelected ? "bg-white/10" : "hover:bg-white/5"
                  )}
                  onClick={() => setRequestedJoinId(request.id)}
                >
                  <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <div>
                      <p className="font-medium text-neutral-0">
                        {request.user_email ?? request.user_id ?? "Unknown"}
                      </p>
                      <p className="text-xs text-neutral-3">
                        {request.group_name ?? "—"} ·{" "}
                        {request.created_at ? new Date(request.created_at).toLocaleString() : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => resolveJoinRequest("approved")}
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => resolveJoinRequest("rejected")}
                      >
                        <ShieldX className="mr-2 h-4 w-4" /> Reject
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
            {joinRequests.length === 0 && (
              <li className="px-4 py-6 text-sm text-neutral-3">No pending requests.</li>
            )}
          </ul>
        </div>
      </section>

      <aside className="space-y-6">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-neutral-0">Invites</h2>
          <p className="text-xs text-neutral-3">
            Resend or revoke pending invites. Keyboard shortcut: M to resend selected invite.
          </p>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <ul className="divide-y divide-white/5">
              {pending && (
                <li className="px-4 py-3">
                  <Skeleton className="h-10 w-full rounded-xl bg-white/10" />
                </li>
              )}
              {invites.map((invite) => {
                const isSelected = selectedInvite === invite.id;
                const createdLabel =
                  invite.status === "pending"
                    ? "Queued for sync"
                    : invite.created_at
                      ? new Date(invite.created_at).toLocaleString()
                      : "—";
                return (
                  <li
                    key={invite.id}
                    className={cn(
                      "cursor-pointer transition",
                      isSelected ? "bg-white/10" : "hover:bg-white/5"
                    )}
                    onClick={() => setRequestedInviteId(invite.id)}
                  >
                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                      <div>
                        <p className="font-medium text-neutral-0">
                          {invite.invitee_msisdn ?? "Unknown"}
                        </p>
                        <p className="text-xs text-neutral-3">
                          {invite.group_name ?? "—"} · {createdLabel}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={pending}
                          onClick={() => handleInviteAction("resend")}
                        >
                          <RefreshCcw className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => handleInviteAction("revoke")}
                        >
                          <ShieldX className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
              {invites.length === 0 && (
                <li className="px-4 py-6 text-sm text-neutral-3">No pending invites.</li>
              )}
            </ul>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-sm font-semibold text-neutral-0">Send invite</h3>
          <p className="text-xs text-neutral-3">
            Send a new invite by providing group ID and MSISDN.
          </p>
          <div className="mt-3 space-y-3">
            <Input
              label="Group ID"
              value={inviteGroup}
              onChange={(event) => setInviteGroup(event.target.value)}
            />
            <Input
              label="MSISDN"
              value={inviteMsisdn}
              onChange={(event) => setInviteMsisdn(event.target.value)}
              placeholder="2507…"
            />
            <Button onClick={submitInvite} disabled={pending} className="w-full">
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MailCheck className="mr-2 h-4 w-4" />
              )}
              Send invite
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}
