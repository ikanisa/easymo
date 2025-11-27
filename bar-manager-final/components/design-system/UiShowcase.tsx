"use client";

import { TrendAreaChart } from "@easymo/ui/charts/TrendAreaChart";
import { Button as UiButton } from "@easymo/ui/components/Button";
import { KpiWidget } from "@easymo/ui/widgets/KpiWidget";
import { useState } from "react";

const chartData = Array.from({ length: 12 }).map((_, index) => ({
  name: `Day ${index + 1}`,
  value: Math.round(80 + Math.sin(index / 2) * 18 + index * 1.4),
  secondaryValue: Math.round(65 + Math.cos(index / 2) * 12 + index),
}));

const vendors = [
  { name: "Kimironko Logistics", status: "Active", volume: "1,284", sla: "98.4%" },
  { name: "Nyamirambo Riders", status: "Monitoring", volume: "832", sla: "92.1%" },
  { name: "Downtown Dispatch", status: "Paused", volume: "128", sla: "76.6%" },
];

export function UiShowcase() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-10">
      <section className="grid gap-6 md:grid-cols-3">
        <KpiWidget
          label="Live dispatches"
          value="42,108"
          changeLabel="+12% vs last week"
          trend="up"
          context="Active dispatch workflows with completions in the last 24h."
        />
        <KpiWidget
          label="Support SLA"
          value="91.2%"
          changeLabel="-2.4% vs goal"
          trend="down"
          context="Resolution under 5 minutes across WhatsApp and hotline."
        />
        <KpiWidget
          label="Agent CSAT"
          value="4.8"
          changeLabel="Steady"
          trend="flat"
          context="Average session feedback gathered after each copilot interaction."
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4 rounded-3xl border border-[color:var(--color-border)]/60 bg-[color:var(--color-surface)]/80 p-5 shadow-[var(--elevation-low)]">
          <h2 className="text-lg font-semibold text-[color:var(--color-foreground)]">Quick actions</h2>
          <input 
            type="text" 
            placeholder="Lookup vendor by phone" 
            className="w-full rounded-lg border border-[color:var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
          <UiButton className="w-full" onClick={() => setDialogOpen(!dialogOpen)}>
            Create escalation
          </UiButton>
          {dialogOpen && (
            <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
              <h3 className="font-semibold">Escalate vendor incident</h3>
              <p className="mt-2 text-sm text-[color:var(--color-muted)]">
                Compose a briefing for the GPT-5 agent to prioritise. The incident timeline is shared to the flow-exchange bridge.
              </p>
              <div className="mt-4 flex gap-2">
                <UiButton variant="outline" onClick={() => setDialogOpen(false)}>Cancel</UiButton>
                <UiButton onClick={() => setDialogOpen(false)}>Submit escalation</UiButton>
              </div>
            </div>
          )}
        </div>
        <div className="rounded-3xl border border-[color:var(--color-border)]/40 bg-[color:var(--color-surface)]/85 p-6 shadow-[var(--elevation-medium)]">
          <h2 className="text-lg font-semibold text-[color:var(--color-foreground)]">Dispatch completion trend</h2>
          <p className="mt-2 text-sm text-[color:var(--color-muted)]">
            Track how triggered dispatches compare to completions across Kigali markets. The series blends Supabase metrics and station
            telemetry.
          </p>
          <div className="mt-6">
            <TrendAreaChart data={chartData} ariaLabel="Dispatch versus completion trend" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-[color:var(--color-foreground)]">Vendor operations</h2>
          <p className="text-sm text-[color:var(--color-muted)]">
            High-touch operators highlighted for manual QA before triggering future automations.
          </p>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)]/50 bg-[color:var(--color-surface)]/80 shadow-[var(--elevation-low)]">
          <table className="w-full min-w-[480px] border-collapse text-left text-sm text-[color:var(--color-foreground)]">
            <thead className="bg-[color:var(--color-surface-muted)]/70 text-xs uppercase tracking-[0.12em] text-[color:var(--color-muted)]">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Vendor</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 font-semibold">7d Volume</th>
                <th scope="col" className="px-4 py-3 font-semibold">SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--color-border)]/30">
              {vendors.map((vendor, index) => (
                <tr
                  key={vendor.name}
                  className={index % 2 === 0
                    ? "bg-[color:var(--color-surface)]/70"
                    : "bg-[color:var(--color-surface-muted)]/40"}
                >
                  <td className="px-4 py-3">{vendor.name}</td>
                  <td className="px-4 py-3">{vendor.status}</td>
                  <td className="px-4 py-3">{vendor.volume}</td>
                  <td className="px-4 py-3">{vendor.sla}</td>
                </tr>
              ))}
            </tbody>
            <caption className="mt-3 text-start text-xs text-[color:var(--color-muted)] px-4 pb-4">
              Insights generated via the GPT-5 copilot and Supabase aggregates.
            </caption>
          </table>
        </div>
      </section>
    </div>
  );
}
