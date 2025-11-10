"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { ShopWizard } from "@/components/shops/ShopWizard";
import { ShopMap } from "@/components/shops/ShopMap";
import { ShopList } from "@/components/shops/ShopList";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
        title="Shops"
        description="Onboard retail partners, visualise nearby inventory, and review shop-level performance metrics."
        actions={<Button variant="outline">Export CSV</Button>}
      />

      <SectionCard
        title="Add a shop"
        description="Capture key catalogue and contact fields then sync to Supabase shops table."
      >
        <ShopWizard defaultCategories={params.category ? [params.category] : []} />
      </SectionCard>

      <SectionCard
        title="Nearby shops"
        description="Plot retail density and inspect category coverage across Kigali."
      >
        <ShopMap shops={shops} />
      </SectionCard>

      <SectionCard
        title="Shop directory"
        description="Search and filter shops. Selecting a card opens the Supabase-backed profile drawer."
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
            placeholder="Search by shop name"
            className="max-w-xs"
          />
        }
      >
        <ShopList shops={shops} isLoading={shopsQuery.isLoading} />
      </SectionCard>
    </div>
  );
}
