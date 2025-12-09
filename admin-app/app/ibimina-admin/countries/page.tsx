import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/observability/logger";
import type { CountryRow } from "@/lib/types/multicountry";

export default async function GovernanceCountriesPage() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("countries")
    .select("id, iso2, iso3, name, is_active")
    .order("name", { ascending: true });

  if (error) {
    logError("admin.countries.fetch_failed", { error });
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-ink">Countries</h2>
          <p className="text-sm text-ink/70">
            Enable new markets and toggle availability per SACCO.
          </p>
        </div>
        <Link
          href="/admin/countries/new"
          className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400"
        >
          Add country
        </Link>
      </header>

      <div className="overflow-hidden rounded-2xl border border-ink/10">
        <table className="min-w-full divide-y divide-ink/10 text-sm">
          <thead className="bg-ink/5">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-ink">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-ink">ISO2</th>
              <th className="px-4 py-3 text-left font-semibold text-ink">ISO3</th>
              <th className="px-4 py-3 text-left font-semibold text-ink">Status</th>
              <th className="px-4 py-3 text-right font-semibold text-ink">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {(data ?? []).map((country: CountryRow) => (
              <tr key={country.id}>
                <td className="px-4 py-3 text-ink/90">{country.name}</td>
                <td className="px-4 py-3 text-ink/70">{country.iso2}</td>
                <td className="px-4 py-3 text-ink/70">{country.iso3}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    {country.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/countries/${country.id}`}
                    className="text-sm font-semibold text-emerald-600"
                  >
                    Configure →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
