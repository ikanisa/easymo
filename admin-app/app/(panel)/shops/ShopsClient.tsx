"use client";

import { useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { ShopList } from "@/components/shops/ShopList";
import { ShopMap } from "@/components/shops/ShopMap";
import { ShopWizard } from "@/components/shops/ShopWizard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SectionCard } from "@/components/ui/SectionCard";
import { type ShopsQueryParams, useShopsQuery } from "@/lib/queries/shops";

interface ShopsClientProps {
  initialParams: ShopsQueryParams;
}

export function ShopsClient({ initialParams }: ShopsClientProps) {
  const [params, setParams] = useState(initialParams);
  const shopsQuery = useShopsQuery(params, {
    refetchInterval: 10000,
  });
  const shops = useMemo(() => shopsQuery.data?.data ?? [], [shopsQuery.data?.data]);

  return (
    <div className="admin-page">
      <PageHeader
        title="Shops & Services"
        description="Onboard general shops or service providers (salons, spare parts, repair centers) and keep sourcing metadata synced."
        actions={<Button variant="outline">Export CSV</Button>}
      />

      <SectionCard
        title="Add a shop or service"
        description="Capture description, business location, and discovery tags. This keeps the Shops & Services agent effective even when AI is offline."
      >
        <ShopWizard />
      </SectionCard>

      <SectionCard
        title="Nearby shops & services"
        description="Plot distribution and inspect coverage for general commerce and services."
      >
        <ShopMap shops={shops} />
      </SectionCard>

      <SectionCard
        title="Directory"
        description="Search and filter across all shops & services. Selecting a card opens the Supabase-backed profile drawer."
        actions={
          <Input
            value={params.search ?? ""}
            onChange={(event) =>
              setParams((prev) => ({
                ...prev,
                search: event.target.value || undefined,
                offset: 0,
              }))
            }
            placeholder="Search by name or tag"
            className="max-w-xs"
          />
        }
      >
        <ShopList shops={shops} isLoading={shopsQuery.isLoading} />
      </SectionCard>
    </div>
  );
}
