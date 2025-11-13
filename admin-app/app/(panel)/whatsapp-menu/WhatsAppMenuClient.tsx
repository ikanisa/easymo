"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { WhatsAppMenuTable } from "@/components/whatsapp-menu/WhatsAppMenuTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import type { WhatsAppHomeMenuItem } from "@/types/whatsapp-menu";

interface WhatsAppMenuClientProps {
  initialItems: WhatsAppHomeMenuItem[];
}

export function WhatsAppMenuClient({ initialItems }: WhatsAppMenuClientProps) {
  const [items, setItems] = useState<WhatsAppHomeMenuItem[]>(initialItems);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async (
    id: string,
    updates: Partial<WhatsAppHomeMenuItem>
  ) => {
    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch("/api/whatsapp-menu", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, ...updates }),
      });

      if (!response.ok) {
        throw new Error("Failed to update menu item");
      }

      const { data } = await response.json();

      setItems((prevItems) =>
        prevItems.map((item) => (item.id === id ? data : item))
      );
    } catch (err) {
      console.error("Error updating menu item:", err);
      setError("Failed to update menu item. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/whatsapp-menu");
      if (!response.ok) {
        throw new Error("Failed to fetch menu items");
      }

      const { data } = await response.json();
      setItems(data);
    } catch (err) {
      console.error("Error fetching menu items:", err);
      setError("Failed to load menu items. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-page">
      <PageHeader
        title="WhatsApp Home Menu"
        description="Manage dynamic home menu items shown to users in WhatsApp. Control which features are active and available per country."
      />

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <SectionCard
        title="Menu Items"
        description="Toggle menu items on/off and control country availability. Changes take effect immediately for new user sessions."
        actions={
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
          >
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        }
      >
        {isLoading ? (
          <LoadingState
            title="Loading menu items"
            description="Fetching WhatsApp home menu configuration."
          />
        ) : items.length > 0 ? (
          <WhatsAppMenuTable
            items={items}
            onUpdate={handleUpdate}
            isUpdating={isUpdating}
          />
        ) : (
          <EmptyState
            title="No menu items found"
            description="Run migrations to create the whatsapp_home_menu_items table and seed initial data."
          />
        )}
      </SectionCard>

      <SectionCard
        title="Usage Instructions"
        description="How to manage WhatsApp home menu items"
      >
        <div className="prose prose-sm max-w-none">
          <ul className="space-y-2 text-sm text-[color:var(--color-text)]">
            <li>
              <strong>Active/Inactive:</strong> Click the status button to
              enable or disable a menu item globally.
            </li>
            <li>
              <strong>Country Selection:</strong> Click country codes (RW, UG,
              KE, etc.) to toggle availability for specific countries.
            </li>
            <li>
              <strong>Display Order:</strong> Items are shown in the order
              specified by the &quot;Order&quot; column.
            </li>
            <li>
              <strong>Immediate Effect:</strong> Changes apply immediately to
              new WhatsApp sessions. Existing sessions may need to restart.
            </li>
          </ul>
        </div>
      </SectionCard>
    </div>
  );
}
