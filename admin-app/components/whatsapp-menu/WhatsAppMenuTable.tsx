"use client";

import { useState } from "react";
import type { WhatsAppHomeMenuItem } from "@/types/whatsapp-menu";

const COUNTRIES = [
  { code: "RW", name: "Rwanda" },
  { code: "UG", name: "Uganda" },
  { code: "KE", name: "Kenya" },
  { code: "TZ", name: "Tanzania" },
  { code: "BI", name: "Burundi" },
  { code: "CD", name: "DR Congo" },
];

interface WhatsAppMenuTableProps {
  items: WhatsAppHomeMenuItem[];
  onUpdate: (id: string, updates: Partial<WhatsAppHomeMenuItem>) => Promise<void>;
  isUpdating: boolean;
}

export function WhatsAppMenuTable({
  items,
  onUpdate,
  isUpdating,
}: WhatsAppMenuTableProps) {
  const handleToggleActive = async (item: WhatsAppHomeMenuItem) => {
    await onUpdate(item.id, { is_active: !item.is_active });
  };

  const handleToggleCountry = async (
    item: WhatsAppHomeMenuItem,
    countryCode: string
  ) => {
    const newCountries = item.active_countries.includes(countryCode)
      ? item.active_countries.filter((c) => c !== countryCode)
      : [...item.active_countries, countryCode];

    await onUpdate(item.id, { active_countries: newCountries });
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-[color:var(--color-border)]">
        <thead className="bg-gray-50/50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-[color:var(--color-muted)] uppercase tracking-wider">
              Order
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[color:var(--color-muted)] uppercase tracking-wider">
              Menu Item
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[color:var(--color-muted)] uppercase tracking-wider">
              Key
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[color:var(--color-muted)] uppercase tracking-wider">
              Active Countries
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-[color:var(--color-muted)] uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-[color:var(--color-border)]">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50/30">
              <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-[color:var(--color-text)]">
                {item.display_order}
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  {item.icon && <span className="text-lg">{item.icon}</span>}
                  <span className="text-sm font-medium text-[color:var(--color-text)]">
                    {item.name}
                  </span>
                </div>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-sm text-[color:var(--color-muted)]">
                <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                  {item.key}
                </code>
              </td>
              <td className="px-4 py-4">
                <div className="flex flex-wrap gap-2">
                  {COUNTRIES.map((country) => {
                    const isActive = item.active_countries.includes(
                      country.code
                    );
                    return (
                      <button
                        key={country.code}
                        onClick={() => handleToggleCountry(item, country.code)}
                        disabled={isUpdating}
                        className={`px-2 py-1 text-xs rounded-md transition-colors ${
                          isActive
                            ? "bg-blue-100 text-blue-700 border border-blue-300"
                            : "bg-gray-100 text-gray-500 border border-gray-300"
                        } hover:opacity-80 disabled:opacity-50`}
                        title={country.name}
                      >
                        {country.code}
                      </button>
                    );
                  })}
                </div>
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <button
                  onClick={() => handleToggleActive(item)}
                  disabled={isUpdating}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    item.is_active
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  } hover:opacity-80 disabled:opacity-50`}
                >
                  {item.is_active ? "Active" : "Inactive"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
