"use client";

import { useSupabaseQuery } from "@/src/v2/lib/supabase/hooks";
import { createClient } from "@/src/v2/lib/supabase/client";
import type { StationRow } from "@/src/v2/lib/supabase/database.types";

export default function StationsPage() {
  const supabase = createClient();
  const { data: stations = [], isLoading } = useSupabaseQuery<StationRow[]>(
    ["stations", "list"],
    async () => {
      const { data, error } = await supabase
        .from("stations")
        .select("id, name, location, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Stations</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage the EasyMO network of partner stations and depots.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Location</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {isLoading && (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-sm text-gray-500">
                  Loading stations…
                </td>
              </tr>
            )}
            {!isLoading &&
              stations.map((station) => (
                <tr key={station.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">{station.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{station.location ?? "—"}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(station.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            {!isLoading && stations.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-sm text-gray-500">
                  No stations registered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
