import Link from "next/link";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/observability/logger";

interface TelcoRow {
  id: string;
  name: string;
  country_id: string | null;
  ussd_pattern: string | null;
  merchant_field_name: string | null;
  reference_field_name: string | null;
}

export default async function TelcoProvidersPage() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("telco_providers")
    .select("id, name, country_id, ussd_pattern, merchant_field_name, reference_field_name")
    .order("name", { ascending: true });

  if (error) {
    logError("admin.telcos.fetch_failed", { error });
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-ink">Telco providers</h2>
          <p className="text-sm text-ink/70">
            Configure mobile money integrations per country and define reference parsing rules.
          </p>
        </div>
        <Link
          href="/admin/telcos/new"
          className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400"
        >
          Add provider
        </Link>
      </header>

      <div className="overflow-hidden rounded-2xl border border-ink/10">
        <table className="min-w-full divide-y divide-ink/10 text-sm">
          <thead className="bg-ink/5">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-ink">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-ink">USSD pattern</th>
              <th className="px-4 py-3 text-left font-semibold text-ink">Merchant field</th>
              <th className="px-4 py-3 text-left font-semibold text-ink">Reference field</th>
              <th className="px-4 py-3 text-right font-semibold text-ink">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {(data ?? []).map((telco: TelcoRow) => (
              <tr key={telco.id}>
                <td className="px-4 py-3 text-ink/90">{telco.name}</td>
                <td className="px-4 py-3 text-xs font-mono text-ink/70">
                  {telco.ussd_pattern ?? "—"}
                </td>
                <td className="px-4 py-3 text-ink/70">{telco.merchant_field_name ?? "merchant"}</td>
                <td className="px-4 py-3 text-ink/70">
                  {telco.reference_field_name ?? "reference"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/telcos/${telco.id}`}
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
