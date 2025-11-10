"use client";

import { useState } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { mockInsuranceCustomers, mockInsuranceRequests } from "@/lib/mock-data";

const currencyFormatter = new Intl.NumberFormat("en-RW", {
  style: "currency",
  currency: "RWF",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(Math.round(value));
}

interface CustomerRecord {
  id: string;
  name: string;
  msisdn: string;
  status: string;
  lastRequestAt: string;
  preferredInsurer: string | null;
  documents: number;
  policies: number;
  outstandingMinor: number;
}

export function CustomersDirectory() {
  const [selected, setSelected] = useState<CustomerRecord | null>(null);

  return (
    <SectionCard
      title="Customers"
      description="Single view of customer insurance history, documentation footprint, and outstanding balances."
    >
      <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)]">
        <table className="min-w-full divide-y divide-[color:var(--color-border)] text-sm">
          <thead className="bg-[color:var(--color-surface-muted)] text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Preferred insurer</th>
              <th className="px-4 py-3 text-left">Policies</th>
              <th className="px-4 py-3 text-left">Outstanding</th>
              <th className="px-4 py-3 text-left">Documents</th>
              <th className="px-4 py-3 text-left">Last request</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-border)] bg-[color:var(--color-surface)]">
            {mockInsuranceCustomers.map((customer) => (
              <tr
                key={customer.id}
                className="cursor-pointer hover:bg-[color:var(--color-border)]/20"
                onClick={() => setSelected(customer)}
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{customer.name}</div>
                  <div className="text-xs text-[color:var(--color-muted)]">{customer.msisdn}</div>
                </td>
                <td className="px-4 py-3">{customer.preferredInsurer ?? "—"}</td>
                <td className="px-4 py-3">{customer.policies}</td>
                <td className="px-4 py-3">{customer.outstandingMinor ? formatCurrency(customer.outstandingMinor) : "—"}</td>
                <td className="px-4 py-3">{customer.documents}</td>
                <td className="px-4 py-3">{new Date(customer.lastRequestAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <Drawer title={selected.name} onClose={() => setSelected(null)}>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Contact</p>
              <p className="font-medium">{selected.msisdn}</p>
            </div>
            <div className="rounded-lg border border-[color:var(--color-border)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Summary</p>
              <ul className="space-y-1 pt-2">
                <li className="flex justify-between">
                  <span>Preferred insurer</span>
                  <span>{selected.preferredInsurer ?? "Not set"}</span>
                </li>
                <li className="flex justify-between">
                  <span>Policies</span>
                  <span>{selected.policies}</span>
                </li>
                <li className="flex justify-between">
                  <span>Outstanding balance</span>
                  <span>{selected.outstandingMinor ? formatCurrency(selected.outstandingMinor) : "Cleared"}</span>
                </li>
              </ul>
            </div>
            <div className="rounded-lg border border-[color:var(--color-border)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Recent requests</p>
              <ul className="space-y-1 pt-2">
                {mockInsuranceRequests
                  .filter((request) => (request.customerId ?? request.customerWaId) === selected.id)
                  .map((request) => (
                    <li key={request.id} className="flex justify-between">
                      <span>{request.id}</span>
                      <span>
                        <Badge variant="outline">{request.status.replace(/_/g, " ")}</Badge>
                      </span>
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
