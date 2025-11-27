"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Drawer";
import { SectionCard } from "@/components/ui/SectionCard";
// Live data only; no mock imports

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
  displayName?: string | null;
  msisdn: string;
  status?: string | null;
  lastSeenAt?: string | null;
}

export function CustomersDirectory() {
  const [selected, setSelected] = useState<CustomerRecord | null>(null);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/users?limit=50", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load users");
        const json = await res.json();
        const data = Array.isArray(json?.data) ? json.data : [];
        const mapped: CustomerRecord[] = data.map((u: any) => ({
          id: String(u.id),
          msisdn: String(u.msisdn ?? ""),
          displayName: u.displayName ?? null,
          status: u.status ?? null,
          lastSeenAt: u.lastSeenAt ?? null,
        }));
        if (mounted) setCustomers(mapped);
      } catch {
        if (mounted) setCustomers([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

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
            {customers.map((customer) => (
              <tr
                key={customer.id}
                className="cursor-pointer hover:bg-[color:var(--color-border)]/20"
                onClick={() => setSelected(customer)}
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{customer.displayName ?? "—"}</div>
                  <div className="text-xs text-[color:var(--color-muted)]">{customer.msisdn}</div>
                </td>
                <td className="px-4 py-3">—</td>
                <td className="px-4 py-3">—</td>
                <td className="px-4 py-3">—</td>
                <td className="px-4 py-3">—</td>
                <td className="px-4 py-3">{customer.lastSeenAt ? new Date(customer.lastSeenAt).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
            {!customers.length && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[color:var(--color-muted)]">{loading ? "Loading…" : "No customers found."}</td>
              </tr>
            )}
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
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Status</p>
              <Badge variant="outline">{selected.status ?? "active"}</Badge>
            </div>
            <div className="rounded-lg border border-[color:var(--color-border)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Recent requests</p>
              <ul className="space-y-1 pt-2">
                <li className="text-[color:var(--color-muted)]">No recent requests.</li>
              </ul>
            </div>
          </div>
        </Drawer>
      )}
    </SectionCard>
  );
}
