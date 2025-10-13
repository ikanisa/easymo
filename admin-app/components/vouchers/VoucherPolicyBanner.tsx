"use client";

import { Pill } from "@/components/ui/Pill";

interface VoucherPolicyBannerProps {
  status: "allow" | "blocked";
  reason?: "opt_out" | "quiet_hours" | "throttled";
  message?: string;
}

const reasonLabel: Record<NonNullable<VoucherPolicyBannerProps["reason"]>, string> = {
  opt_out: "Opt-out",
  quiet_hours: "Quiet hours",
  throttled: "Throttle limit",
};

export function VoucherPolicyBanner({ status, reason, message }: VoucherPolicyBannerProps) {
  if (status === "allow") {
    return (
      <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-700">
        <Pill tone="success">Send allowed</Pill>
        <p className="mt-2">
          Policy checks passed. You can proceed to send this voucher.
        </p>
      </div>
    );
  }

  const label = reason ? reasonLabel[reason] : "Policy block";

  return (
    <div className="rounded-xl border border-amber-200/70 bg-amber-50/70 px-4 py-3 text-sm text-amber-800">
      <Pill tone="warning">Send blocked</Pill>
      <p className="mt-2 font-medium">{label}</p>
      <p className="mt-1">{message ?? "This voucher cannot be sent right now. Adjust the configuration and retry."}</p>
    </div>
  );
}
