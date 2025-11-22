"use client";

import { Badge } from "@/components/ui/Badge";
import { Drawer } from "@/components/ui/Drawer";
import type { Shop } from "@/lib/shops/types";

interface ShopProfileDrawerProps {
  shop: Shop | null;
  onClose: () => void;
}

export function ShopProfileDrawer({ shop, onClose }: ShopProfileDrawerProps) {
  if (!shop) return null;

  return (
    <Drawer
      title={`${shop.name} · ${shop.phone ?? "No phone"}`}
      onClose={onClose}
      description="Profile data synced from Supabase shops table."
    >
      <div className="space-y-4 text-sm">
        <div className="flex items-center gap-3">
          <Badge variant={shop.verified ? "green" : "outline"}>{shop.verified ? "Verified" : "Unverified"}</Badge>
          <Badge variant="outline">{shop.status}</Badge>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Description</h4>
          <p className="mt-1 text-[color:var(--color-foreground)]">{shop.description || "No description provided."}</p>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">Discovery tags</h4>
          <p className="mt-1 text-[color:var(--color-foreground)]">
            {shop.tags.length ? shop.tags.join(", ") : "general"}
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <p className="text-xs text-[color:var(--color-muted)]">WhatsApp catalog</p>
            <p className="text-[color:var(--color-foreground)]">
              {shop.whatsappCatalogUrl ? (
                <a href={shop.whatsappCatalogUrl} className="text-[color:var(--color-accent)] underline" target="_blank" rel="noreferrer">
                  {shop.whatsappCatalogUrl}
                </a>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-[color:var(--color-muted)]">Opening hours</p>
            <p className="text-[color:var(--color-foreground)]">{shop.openingHours ?? "Not set"}</p>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <p className="text-xs text-[color:var(--color-muted)]">Rating</p>
            <p className="text-[color:var(--color-foreground)]">
              {shop.rating != null ? `${shop.rating.toFixed(1)} / 5` : "No reviews"}
            </p>
          </div>
          <div>
            <p className="text-xs text-[color:var(--color-muted)]">Total reviews</p>
            <p className="text-[color:var(--color-foreground)]">{shop.totalReviews}</p>
          </div>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
            Business location
          </h4>
          <p className="mt-1 text-[color:var(--color-foreground)]">
            {shop.businessLocation ?? "No description provided"}
          </p>
          <p className="text-xs text-[color:var(--color-muted)]">
            {shop.coordinates
              ? `${shop.coordinates.lat.toFixed(4)}, ${shop.coordinates.lng.toFixed(4)}`
              : "No GPS coordinates"}
          </p>
        </div>
        <div className="text-xs text-[color:var(--color-muted)]">
          Synced {new Date(shop.updatedAt).toLocaleString()} · Created {new Date(shop.createdAt).toLocaleString()}
        </div>
      </div>
    </Drawer>
  );
}
