"use client";

import { useState, type ComponentProps } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import {
  mockInsurancePolicies,
  mockInsuranceRequests,
} from "@/lib/mock-data";

const currencyFormatter = new Intl.NumberFormat("en-RW", {
  style: "currency",
  currency: "RWF",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(Math.round(value));
}

type PolicyMock = (typeof mockInsurancePolicies)[number];
type RequestMock = (typeof mockInsuranceRequests)[number];

interface PolicyDetail {
  policy: PolicyMock;
  request: RequestMock | undefined;
}

const statusVariant: Record<PolicyMock["status"], ComponentProps<typeof Badge>["variant"]> = {
  draft: "outline",
  pending_issue: "warning",
  active: "success",
  expired: "default",
  cancelled: "destructive",
};

export function PoliciesDatabase() {
  const [selected, setSelected] = useState<PolicyDetail | null>(null);

  return (
    <SectionCard
      title="Policies database"
      description="Central repository for issued policies, breakdowns, and metadata synced from Supabase."
    >
      <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)]">
        <table className="min-w-full divide-y divide-[color:var(--color-border)] text-sm">
          <thead className="bg-[color:var(--color-surface-muted)] text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Policy</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Insurer</th>
              <th className="px-4 py-3 text-left">Effective dates</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-border)] bg-[color:var(--color-surface)]">
            {mockInsurancePolicies.map((policy) => {
              const request = mockInsuranceRequests.find((item) => item.id === policy.requestId);
              return (
                <tr
                  key={policy.id}
                  className="cursor-pointer hover:bg-[color:var(--color-border)]/20"
                  onClick={() => setSelected({ policy, request })}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{policy.policyNumber ?? policy.id}</div>
                    <div className="text-xs text-[color:var(--color-muted)]">
                      {request?.vehicle?.plateNumber ?? "Unlinked"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{request?.customerName ?? "—"}</div>
                    <div className="text-xs text-[color:var(--color-muted)]">{request?.customerMsisdn ?? ""}</div>
                  </td>
                  <td className="px-4 py-3">{policy.insurer}</td>
                  <td className="px-4 py-3">
                    {policy.effectiveFrom
                      ? `${new Date(policy.effectiveFrom).toLocaleDateString()} → ${policy.effectiveTo ? new Date(policy.effectiveTo).toLocaleDateString() : "TBD"}`
                      : "Awaiting issuance"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[policy.status]}>
                      {policy.status.replace(/_/g, " ")}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <Drawer
          title={`Policy ${selected.policy.policyNumber ?? selected.policy.id}`}
          onClose={() => setSelected(null)}
        >
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Customer</p>
              <p className="font-medium">{selected.request?.customerName ?? "Unknown"}</p>
              <p className="text-xs text-[color:var(--color-muted)]">{selected.request?.customerMsisdn ?? ""}</p>
            </div>
            <div className="rounded-lg border border-[color:var(--color-border)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Breakdown</p>
              <ul className="space-y-1 pt-2">
                {selected.policy.breakdown.map((item) => (
                  <li key={item.id} className="flex justify-between">
                    <span>{item.label}</span>
                    <span>{formatCurrency(item.amountMinor)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-[color:var(--color-border)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Metadata</p>
              <ul className="space-y-1 pt-2">
                <li className="flex justify-between">
                  <span>Insurer</span>
                  <span>{selected.policy.insurer}</span>
                </li>
                <li className="flex justify-between">
                  <span>Premium total</span>
                  <span>{formatCurrency(selected.policy.premiumTotalMinor ?? 0)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Status</span>
                  <Badge variant={statusVariant[selected.policy.status]}>
                    {selected.policy.status}
                  </Badge>
                </li>
              </ul>
            </div>
          </div>
        </Drawer>
      )}
    </SectionCard>
  );
}
