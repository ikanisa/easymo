"use client";

import Link from "next/link";
import type { AdminHubSections } from "@/lib/schemas";
import { adminRoutePaths, toAdminRoute, type NavigableAdminRouteKey } from "@/lib/routes";
import { ChevronRight } from "lucide-react";

const SECTION_LINKS: Record<
  string,
  { route: NavigableAdminRouteKey; description: string; verb: string }
> = {
  "ADMIN::OPS_MARKETPLACE": {
    route: "panelBars",
    description: "Manage vendor marketplace roster and inventory status",
    verb: "Manage",
  },
  "ADMIN::OPS_WALLET": {
    route: "panelSettings",
    description: "Manage balances, tokens, and reconciliation controls",
    verb: "Manage",
  },
  "ADMIN::OPS_MOMO": {
    route: "panelQr",
    description: "Manage MoMo QR payloads and deep links",
    verb: "Manage",
  },
  "ADMIN::TRUST_REFERRALS": {
    route: "panelUsers",
    description: "Review referral audits and customer resolution actions",
    verb: "Review",
  },
  "ADMIN::TRUST_FREEZE": {
    route: "panelUsers",
    description: "Freeze or unfreeze accounts during incidents",
    verb: "Manage",
  },
  "ADMIN::DIAG_MATCH": {
    route: "panelLogs",
    description: "View matching diagnostics and RPC latency monitors",
    verb: "View",
  },
  "ADMIN::DIAG_INSURANCE": {
    route: "panelInsurance",
    description: "Monitor OCR queue health and manual review backlog",
    verb: "Monitor",
  },
  "ADMIN::DIAG_HEALTH": {
    route: "panelDashboard",
    description: "View system health KPIs and alert feed",
    verb: "View",
  },
  "ADMIN::DIAG_LOGS": {
    route: "panelLogs",
    description: "Browse unified audit and messaging events log",
    verb: "Browse",
  },
};

const DISABLED_SECTION_IDS = new Set([
  "ADMIN::OPS_TRIPS",
]);

const GROUP_LABELS: Array<{ key: keyof AdminHubSections; title: string }> = [
  { key: "operations", title: "OPERATIONS" },
  { key: "growth", title: "GROWTH" },
  { key: "trust", title: "TRUST" },
  { key: "diagnostics", title: "DIAGNOSTICS" },
];

function SectionGroup({
  title,
  items,
}: {
  title: string;
  items: AdminHubSections[keyof AdminHubSections];
}) {
  const visibleItems = items.filter((item) => !DISABLED_SECTION_IDS.has(item.id));
  if (!visibleItems.length) return null;
  
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </h3>
      <ul className="space-y-2">
        {visibleItems.map((item) => {
          const meta = SECTION_LINKS[item.id];
          const isDestructive = item.id === "ADMIN::TRUST_FREEZE";
          
          return (
            <li key={item.id}>
              {meta?.route ? (
                <Link
                  href={toAdminRoute(adminRoutePaths[meta.route])}
                  className={`
                    group flex items-center justify-between gap-3 rounded-lg border p-4
                    transition-all duration-200 min-h-[64px]
                    ${isDestructive 
                      ? 'border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-300' 
                      : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 hover:shadow-sm'
                    }
                  `}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-base font-semibold mb-1 ${isDestructive ? 'text-red-900' : 'text-gray-900'}`}>
                      {item.title}
                    </p>
                    {meta.description && (
                      <p className={`text-sm line-clamp-1 ${isDestructive ? 'text-red-700' : 'text-gray-600'}`}>
                        {meta.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-sm font-medium ${isDestructive ? 'text-red-700' : 'text-blue-600 group-hover:text-blue-700'}`}>
                      {meta.verb}
                    </span>
                    <ChevronRight className={`h-5 w-5 transition-transform group-hover:translate-x-0.5 ${isDestructive ? 'text-red-600' : 'text-gray-400 group-hover:text-blue-600'}`} />
                  </div>
                </Link>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 opacity-60 min-h-[64px]">
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-gray-700 mb-1">
                      {item.title}
                    </p>
                    <p className="text-sm text-gray-500">
                      Configuration required
                    </p>
                  </div>
                </div>
              )}
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
    <div className="space-y-6">
      {messages && messages.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-900 mb-1">Configuration Note</p>
          {messages.map((message, index) => (
            <p key={index} className="text-sm text-blue-700">{message}</p>
          ))}
        </div>
      )}
      <div className="grid gap-8 md:grid-cols-2">
        {GROUP_LABELS.map(({ key, title }) => (
          <SectionGroup key={key} title={title} items={sections[key]} />
        ))}
      </div>
    </div>
  );
}
