"use client";

import { useTransition } from "react";
import { useToast } from "@/providers/toast-provider";
import { backfillOrgMemberships } from "@/app/(main)/admin/actions";

export function BackfillButton() {
  const { success, error } = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => {
        startTransition(async () => {
          const result = await backfillOrgMemberships();
          if (result.status === "error") {
            error(result.message ?? "Backfill failed");
          } else {
            success(
              result.message ?? `Backfill complete${result.count ? ` (${result.count})` : ""}`
            );
          }
        });
      }}
      disabled={pending}
      className="rounded-xl bg-kigali px-4 py-2 text-sm font-semibold text-ink shadow-glass disabled:opacity-60"
    >
      {pending ? "Backfilling…" : "Backfill org memberships"}
    </button>
  );
}
