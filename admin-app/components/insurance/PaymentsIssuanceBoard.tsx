"use client";

import { useMemo, useState, type ComponentProps } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  mockInsurancePayments,
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

type InsurancePolicyMock = (typeof mockInsurancePolicies)[number];
type InsurancePaymentMock = (typeof mockInsurancePayments)[number];
type InsuranceRequestMock = (typeof mockInsuranceRequests)[number];

interface PolicyRow {
  policy: InsurancePolicyMock;
  request: InsuranceRequestMock | undefined;
  payment: InsurancePaymentMock | undefined;
}

function buildRows(): PolicyRow[] {
  return mockInsurancePolicies.map((policy) => ({
    policy,
    request: mockInsuranceRequests.find((request) => request.id === policy.requestId),
    payment: mockInsurancePayments.find((payment) => payment.policyId === policy.id),
  }));
}

const paymentStatusVariant: Record<InsurancePaymentMock["status"], ComponentProps<typeof Badge>["variant"]> = {
  pending: "warning",
  in_review: "outline",
  completed: "success",
  failed: "destructive",
  refunded: "default",
};

const policyStatusVariant: Record<InsurancePolicyMock["status"], ComponentProps<typeof Badge>["variant"]> = {
  draft: "outline",
  pending_issue: "warning",
  active: "success",
  expired: "default",
  cancelled: "destructive",
};

export function PaymentsIssuanceBoard() {
  const [selected, setSelected] = useState<PolicyRow | null>(null);
  const rows = useMemo(buildRows, []);

  return (
    <SectionCard
      title="Payments and issuance"
      description="Track settlement, issuance packages, and finance handoffs. Data syncs back to Supabase `payments` and `policies` tables."
    >
      <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)]">
        <table className="min-w-full divide-y divide-[color:var(--color-border)] text-sm">
          <thead className="bg-[color:var(--color-surface-muted)] text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Policy</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Insurer</th>
              <th className="px-4 py-3 text-left">Gross premium</th>
              <th className="px-4 py-3 text-left">Payment status</th>
              <th className="px-4 py-3 text-left">Issuance status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-border)] bg-[color:var(--color-surface)]">
            {rows.map((row) => (
              <tr
                key={row.policy.id}
                className="hover:bg-[color:var(--color-border)]/20"
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{row.policy.policyNumber ?? row.policy.id}</div>
                  <div className="text-xs text-[color:var(--color-muted)]">
                    {row.request?.vehicle?.plateNumber ?? "Pending"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{row.request?.customerName ?? "—"}</div>
                  <div className="text-xs text-[color:var(--color-muted)]">{row.request?.customerMsisdn ?? ""}</div>
                </td>
                <td className="px-4 py-3">{row.policy.insurer}</td>
                <td className="px-4 py-3">{formatCurrency(row.policy.premiumTotalMinor ?? 0)}</td>
                <td className="px-4 py-3">
                  {row.payment ? (
                    <Badge variant={paymentStatusVariant[row.payment.status]}>
                      {row.payment.status.replace(/_/g, " ")}
                    </Badge>
                  ) : (
                    <span className="text-xs text-[color:var(--color-muted)]">No payment</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={policyStatusVariant[row.policy.status]}>
                    {row.policy.status.replace(/_/g, " ")}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => setSelected(row)}>
                    View timeline
                  </Button>
                </td>
              </tr>
            ))}
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
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                Customer
              </p>
              <p className="pt-1 font-medium">{selected.request?.customerName ?? "Unknown"}</p>
              <p className="text-xs text-[color:var(--color-muted)]">{selected.request?.customerMsisdn ?? ""}</p>
            </div>
            <div className="rounded-lg border border-[color:var(--color-border)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                Premium summary
              </p>
              <ul className="space-y-1 pt-2">
                <li className="flex justify-between">
                  <span>Gross premium</span>
                  <span className="font-semibold">{formatCurrency(selected.policy.premiumTotalMinor ?? 0)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Fees</span>
                  <span>{formatCurrency(selected.policy.feesMinor ?? 0)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Status</span>
                  <Badge variant={policyStatusVariant[selected.policy.status]}>
                    {selected.policy.status}
                  </Badge>
                </li>
              </ul>
            </div>
            <div className="rounded-lg border border-[color:var(--color-border)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                Payment timeline
              </p>
              {selected.payment ? (
                <ul className="space-y-1 pt-2">
                  <li className="flex justify-between">
                    <span>Status</span>
                    <Badge variant={paymentStatusVariant[selected.payment.status]}>
                      {selected.payment.status.replace(/_/g, " ")}
                    </Badge>
                  </li>
                  <li className="flex justify-between">
                    <span>Amount</span>
                    <span>{formatCurrency(selected.payment.amountMinor)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Reference</span>
                    <span>{selected.payment.reference ?? "—"}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Paid at</span>
                    <span>{selected.payment.paidAt ? new Date(selected.payment.paidAt).toLocaleString() : "Pending"}</span>
                  </li>
                </ul>
              ) : (
                <p className="pt-2 text-[color:var(--color-muted)]">No payment recorded yet.</p>
              )}
            </div>
            <div className="rounded-lg border border-[color:var(--color-border)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Next steps</p>
              <ul className="list-disc space-y-1 pl-4 pt-2">
                <li>Ensure policy PDF is stored in Documents Library.</li>
                <li>Notify finance when settlement confirmation hits Supabase.</li>
                <li>Trigger renewal reminder once policy becomes active.</li>
              </ul>
            </div>
          </div>
        </Drawer>
      )}
    </SectionCard>
  );
}
