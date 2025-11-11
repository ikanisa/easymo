"use client";

import { useState } from "react";
import type { Shop } from "@/lib/shops/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { Badge } from "@/components/ui/Badge";
import { ShopProfileDrawer } from "@/components/shops/ShopProfileDrawer";

interface ShopListProps {
  shops: Shop[];
  isLoading?: boolean;
}

export function ShopList({ shops, isLoading }: ShopListProps) {
  const [selected, setSelected] = useState<Shop | null>(null);

  if (isLoading) {
    return <LoadingState title="Loading shops" description="Querying Supabase shops table." />;
  }

  if (!shops.length) {
    return (
      <EmptyState
        title="No shops or services found"
        description="Add a shop/service or verify Supabase credentials to load records."
      />
    );
  }

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-2">
        {shops.map((shop) => (
          <button
            key={shop.id}
            type="button"
            onClick={() => setSelected(shop)}
            className="rounded-2xl border border-[color:var(--color-border)] bg-white/80 px-4 py-3 text-left shadow-sm transition hover:border-[color:var(--color-accent)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-[color:var(--color-foreground)]">{shop.name}</p>
                <p className="text-xs text-[color:var(--color-muted)]">{shop.businessLocation ?? "Business location pending"}</p>
                <p className="text-xs text-[color:var(--color-muted)]">{shop.phone ?? "No phone"}</p>
              </div>
              <Badge variant={shop.verified ? "green" : "outline"}>{shop.verified ? "Verified" : "Pending"}</Badge>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-[color:var(--color-muted)]">{shop.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-muted)]">
              {shop.tags.length
                ? shop.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-[color:var(--color-surface)] px-2 py-1">
                      {tag}
                    </span>
                  ))
                : (
                    <span className="rounded-full bg-[color:var(--color-surface)] px-2 py-1">
                      general
                    </span>
                  )}
            </div>
          </button>
        ))}
      </div>
      <ShopProfileDrawer shop={selected} onClose={() => setSelected(null)} />
    </>
  );
}
