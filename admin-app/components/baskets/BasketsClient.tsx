"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  useSaccosQuery,
  useIbiminaQuery,
  type BasketsQueryParams,
} from "@/lib/queries/baskets";
import { adminRoutePaths, type NavigableAdminRouteKey } from "@/lib/routes";

type BasketsClientProps = {
  saccoParams: BasketsQueryParams;
  ibiminaParams: BasketsQueryParams;
};

const QUICK_LINKS: Array<{ label: string; route: NavigableAdminRouteKey }> = [
  { label: "Branches & Officers", route: "panelBasketsSaccoBranches" },
  { label: "Ibimina Registry", route: "panelBasketsIbimina" },
  { label: "KYC Queue", route: "panelBasketsKyc" },
  { label: "Membership Management", route: "panelBasketsMemberships" },
  { label: "Contribution Rules & Cycles", route: "panelBasketsContributionRules" },
  { label: "Contributions Ledger", route: "panelBasketsContributions" },
  { label: "Unmatched SMS", route: "panelBasketsReconciliation" },
  { label: "Loan Requests", route: "panelBasketsLoans" },
  { label: "Settings", route: "panelBasketsSettings" },
];

export function BasketsClient({ saccoParams, ibiminaParams }: BasketsClientProps) {
  const saccoQuery = useSaccosQuery(saccoParams);
  const ibiminaQuery = useIbiminaQuery(ibiminaParams);

  const totalSaccos = saccoQuery.data?.total ?? 0;
  const totalIbimina = ibiminaQuery.data?.total ?? 0;

  const highlightedSaccos = useMemo(() => (
    saccoQuery.data?.data.slice(0, 4) ?? []
  ), [saccoQuery.data]);

  const highlightedIbimina = useMemo(() => (
    ibiminaQuery.data?.data.slice(0, 5) ?? []
  ), [ibiminaQuery.data]);

  return (
    <div className="admin-page">
      <PageHeader
        title="Baskets (SACCOs)"
        description="Manage SACCO branches, Ibimina groups, contributions, reconciliation, and loans."
      />

      <SectionCard
        title="SACCO Branches"
        description="Recently onboarded SACCO branches and officers."
        actions={[
          <Link
            key="view-all"
            href={adminRoutePaths.panelBasketsSaccoBranches}
            className="text-sm font-medium text-primary hover:underline"
          >
            View all
          </Link>,
        ]}
      >
        {saccoQuery.isLoading ? (
          <LoadingState
            title="Loading SACCO branches"
            description="Fetching sacco registry."
          />
        ) : highlightedSaccos.length ? (
          <ul className="space-y-3">
            {highlightedSaccos.map((sacco) => (
              <li key={sacco.id} className="rounded-lg border border-foreground/10 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{sacco.name}</h3>
                    <p className="text-sm text-foreground/70">
                      Branch {sacco.branchCode}
                      {sacco.umurengeName ? ` • ${sacco.umurengeName}` : ''}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase">
                    {sacco.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No SACCO branches yet"
            description="Create branches via the dedicated management page."
          />
        )}
      </SectionCard>

      <SectionCard
        title="Ibimina Snapshot"
        description="Latest Ibimina pending review or newly activated."
        actions={[
          <Link
            key="view-ibimina"
            href={adminRoutePaths.panelBasketsIbimina}
            className="text-sm font-medium text-primary hover:underline"
          >
            Inspect registry
          </Link>,
        ]}
      >
        {ibiminaQuery.isLoading ? (
          <LoadingState
            title="Loading Ibimina"
            description="Fetching ibimina registry."
          />
        ) : highlightedIbimina.length ? (
          <ul className="space-y-3">
            {highlightedIbimina.map((ikimina) => (
              <li key={ikimina.id} className="rounded-lg border border-foreground/10 p-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{ikimina.name}</h3>
                    <span className="rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium uppercase">
                      {ikimina.status}
                    </span>
                  </div>
                  {ikimina.sacco ? (
                    <p className="text-sm text-foreground/70">
                      SACCO: {ikimina.sacco.name}
                      {ikimina.sacco.branchCode ? ` • ${ikimina.sacco.branchCode}` : ''}
                    </p>
                  ) : (
                    <p className="text-sm text-foreground/50">No SACCO linked</p>
                  )}
                  {ikimina.description ? (
                    <p className="text-sm text-foreground/70 line-clamp-2">{ikimina.description}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No Ibimina yet"
            description="New ikimina requests will appear after WhatsApp onboarding."
          />
        )}
      </SectionCard>

      <SectionCard
        title="Operations Checklist"
        description={`Track the ${totalSaccos} SACCO branches and ${totalIbimina} Ibimina onboarded so far.`}
      >
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((link) => (
            <li key={link.route}>
              <Link
                className="block rounded-lg border border-dashed border-foreground/20 px-4 py-3 text-sm font-medium hover:border-primary hover:bg-primary/5"
                href={adminRoutePaths[link.route]}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
