"use client";

import Link from "next/link";
import type { AdminHubSections } from "@/lib/schemas";
import { adminRoutePaths, toAdminRoute, type NavigableAdminRouteKey } from "@/lib/routes";

const SECTION_LINKS: Record<
  string,
  { route: NavigableAdminRouteKey; description: string }
> = {
  "ADMIN::OPS_TRIPS": {
    route: "panelOrders",
    description: "Monitor live trip matching and manual overrides.",
  },
  "ADMIN::OPS_MARKETPLACE": {
    route: "panelBars",
    description: "Vendor marketplace roster and inventory status.",
  },
  "ADMIN::OPS_WALLET": {
    route: "panelSettings",
    description: "Wallet balances, tokens, and reconciliation controls.",
  },
  "ADMIN::OPS_MOMO": {
    route: "panelQr",
    description: "Manage MoMo QR payloads and deep links.",
  },
  "ADMIN::OPS_VOUCHERS": {
    route: "panelVouchers",
    description: "Issue, preview, and redeem vouchers.",
  },
  "ADMIN::GROW_PROMOTERS": {
    route: "panelCampaigns",
    description: "Promoter tooling and growth actions.",
  },
  "ADMIN::GROW_BROADCAST": {
    route: "panelCampaigns",
    description: "Broadcast orchestration and targeting lists.",
  },
  "ADMIN::GROW_TEMPLATES": {
    route: "panelTemplates",
    description: "Template catalogue and flow JSON references.",
  },
  "ADMIN::TRUST_REFERRALS": {
    route: "panelUsers",
    description: "Referral audits and customer resolution actions.",
  },
  "ADMIN::TRUST_FREEZE": {
    route: "panelUsers",
    description: "Freeze / unfreeze accounts during incidents.",
  },
  "ADMIN::DIAG_MATCH": {
    route: "panelLogs",
    description: "Matching diagnostics and RPC latency monitors.",
  },
  "ADMIN::DIAG_INSURANCE": {
    route: "panelInsurance",
    description: "OCR queue health and manual review backlog.",
  },
  "ADMIN::DIAG_HEALTH": {
    route: "panelDashboard",
    description: "System health KPIs and alert feed.",
  },
  "ADMIN::DIAG_LOGS": {
    route: "panelLogs",
    description: "Unified audit and voucher events log.",
  },
};

const GROUP_LABELS: Array<{ key: keyof AdminHubSections; title: string }> = [
  { key: "operations", title: "Operations" },
  { key: "growth", title: "Growth" },
  { key: "trust", title: "Trust" },
  { key: "diagnostics", title: "Diagnostics" },
];

function SectionGroup({
  title,
  items,
}: {
  title: string;
  items: AdminHubSections[keyof AdminHubSections];
}) {
  if (!items.length) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ul className="grid gap-3">
        {items.map((item) => {
          const meta = SECTION_LINKS[item.id];
          return (
            <li
              key={item.id}
              className="rounded-md border border-border bg-card p-3 shadow-sm"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {item.title}
                  </p>
                  {meta?.description && (
                    <p className="text-xs text-muted-foreground">
                      {meta.description}
                    </p>
                  )}
                </div>
                {meta?.route && (
                  <Link
                    href={toAdminRoute(adminRoutePaths[meta.route])}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Open
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AdminHubSectionGrid({
  sections,
  messages,
}: {
  sections: AdminHubSections;
  messages?: string[];
}) {
  return (
    <div className="space-y-4">
      {messages && messages.length > 0 && (
        <div className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          {messages.map((message, index) => (
            <p key={index}>{message}</p>
          ))}
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        {GROUP_LABELS.map(({ key, title }) => (
          <SectionGroup key={key} title={title} items={sections[key]} />
        ))}
      </div>
    </div>
  );
}
