"use client";

import { useMemo, useState, type ComponentProps } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  mockInsurancePayments,
  mockInsuranceRequests,
  mockInsuranceTasks,
} from "@/lib/mock-data";

const currencyFormatter = new Intl.NumberFormat("en-RW", {
  style: "currency",
  currency: "RWF",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(Math.round(value));
}

type RequestMock = (typeof mockInsuranceRequests)[number];
type PaymentMock = (typeof mockInsurancePayments)[number];
type TaskMock = (typeof mockInsuranceTasks)[number];

const statusVariant: Record<RequestMock["status"], ComponentProps<typeof Badge>["variant"]> = {
  draft: "outline",
  intake: "outline",
  under_review: "warning",
  quoted: "default",
  awaiting_payment: "warning",
  paid: "success",
  issued: "success",
  cancelled: "destructive",
};

interface RequestDetail extends RequestMock {
  outstandingMinor: number;
  overdueTasks: number;
}

function deriveOutstanding(request: RequestMock): number {
  return mockInsurancePayments
    .filter((payment) => payment.requestId === request.id)
    .filter((payment) => payment.status !== "completed")
    .reduce((total, payment) => total + payment.amountMinor, 0);
}

function deriveOverdueTasks(request: RequestMock): number {
  const now = Date.now();
  return mockInsuranceTasks
    .filter((task) => task.requestId === request.id)
    .filter((task) => task.dueAt && new Date(task.dueAt).getTime() < now)
    .filter((task) => task.status !== "completed" && task.status !== "cancelled").length;
}

export function RequestsDatabase() {
  const [selected, setSelected] = useState<RequestDetail | null>(null);
  const rows = useMemo<RequestDetail[]>(
    () =>
      mockInsuranceRequests.map((request) => ({
        ...request,
        outstandingMinor: deriveOutstanding(request),
        overdueTasks: deriveOverdueTasks(request),
      })),
    [],
  );

  return (
    <SectionCard
      title="Requests database"
      description="Full history of insurance requests with outstanding balances, tasks, and comparisons."
    >
      <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)]">
        <table className="min-w-full divide-y divide-[color:var(--color-border)] text-sm">
          <thead className="bg-[color:var(--color-surface-muted)] text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Request</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Outstanding</th>
              <th className="px-4 py-3 text-left">Tasks overdue</th>
              <th className="px-4 py-3 text-left">Quotes</th>
              <th className="px-4 py-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-border)] bg-[color:var(--color-surface)]">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">
                  <div className="font-medium">{row.id}</div>
                  <div className="text-xs text-[color:var(--color-muted)]">{row.vehicle?.plateNumber ?? "—"}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{row.customerName}</div>
                  <div className="text-xs text-[color:var(--color-muted)]">{row.customerMsisdn}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant[row.status]}>{row.status.replace(/_/g, " ")}</Badge>
                </td>
                <td className="px-4 py-3">{row.outstandingMinor ? formatCurrency(row.outstandingMinor) : "—"}</td>
                <td className="px-4 py-3">{row.overdueTasks}</td>
                <td className="px-4 py-3">{row.comparison.length}</td>
                <td className="px-4 py-3">
                  <Button variant="outline" size="sm" onClick={() => setSelected(row)}>
                    Open
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <Drawer title={`Request ${selected.id}`} onClose={() => setSelected(null)}>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Status</p>
              <Badge variant={statusVariant[selected.status]}>{selected.status}</Badge>
            </div>
            <div className="rounded-lg border border-[color:var(--color-border)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Payments</p>
              <ul className="space-y-1 pt-2">
                {mockInsurancePayments
                  .filter((payment) => payment.requestId === selected.id)
                  .map((payment: PaymentMock) => (
                    <li key={payment.id} className="flex justify-between">
                      <span>{payment.status.replace(/_/g, " ")}</span>
                      <span>{formatCurrency(payment.amountMinor)}</span>
                    </li>
                  ))}
              </ul>
            </div>
            <div className="rounded-lg border border-[color:var(--color-border)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Tasks</p>
              <ul className="space-y-1 pt-2">
                {mockInsuranceTasks
                  .filter((task) => task.requestId === selected.id)
                  .map((task: TaskMock) => (
                    <li key={task.id} className="flex justify-between">
                      <span>{task.title}</span>
                      <span className="text-[color:var(--color-muted)]">{task.status}</span>
                    </li>
                  ))}
              </ul>
            </div>
            <div className="rounded-lg border border-[color:var(--color-border)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Quotes</p>
              <ul className="space-y-1 pt-2">
                {selected.comparison.map((quote) => (
                  <li key={quote.insurer} className="flex justify-between">
                    <span>{quote.insurer}</span>
                    <span>{formatCurrency(quote.grossPremiumMinor)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Drawer>
      )}
    </SectionCard>
  );
}
