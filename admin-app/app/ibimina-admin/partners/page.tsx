import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/observability/logger";

interface PartnerRow {
  org_id: string;
  enabled_features: string[] | null;
  merchant_code: string | null;
  reference_prefix: string | null;
  contact: Record<string, unknown> | null;
  organizations?: { name: string | null } | null;
}

export default async function PartnerConfigPage() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("partner_config")
    .select(
      "org_id, enabled_features, merchant_code, reference_prefix, contact, organizations(name)"
    )
    .order("org_id", { ascending: true });

  if (error) {
    logError("admin.partners.fetch_failed", { error });
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-ink">Partner configuration</h2>
          <p className="text-sm text-ink/70">
            Manage feature flags and reference prefixes for SACCO partners.
          </p>
        </div>
        <Link
          href="/admin/partners/new"
          className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400"
        >
          Add partner
        </Link>
      </header>

      <div className="overflow-hidden rounded-2xl border border-ink/10">
        <table className="min-w-full divide-y divide-ink/10 text-sm">
          <thead className="bg-ink/5">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-ink">Partner</th>
              <th className="px-4 py-3 text-left font-semibold text-ink">Merchant</th>
              <th className="px-4 py-3 text-left font-semibold text-ink">Reference prefix</th>
              <th className="px-4 py-3 text-left font-semibold text-ink">Enabled features</th>
              <th className="px-4 py-3 text-right font-semibold text-ink">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {(data ?? []).map((row: PartnerRow) => (
              <tr key={row.org_id}>
                <td className="px-4 py-3 text-ink/90">{row.organizations?.name ?? row.org_id}</td>
                <td className="px-4 py-3 text-ink/70">{row.merchant_code ?? "—"}</td>
                <td className="px-4 py-3 text-ink/70">{row.reference_prefix ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {(row.enabled_features ?? []).map((feature) => (
                      <span
                        key={feature}
                        className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/partners/${row.org_id}`}
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

      <p className="text-xs text-ink/60">
        Need to edit partner metadata? Use the API or contact platform engineering for assistance.
      </p>
    </div>
  );
}
