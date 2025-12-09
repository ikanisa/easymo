import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const parseList = (value: string | null): string[] | null => {
  if (!value) return null;
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : null;
};

const createPartnerConfig = async (formData: FormData) => {
  "use server";

  const supabase = createSupabaseAdminClient();
  const contactEmail = (formData.get("contactEmail") as string | null)?.trim() || null;
  const contactPhone = (formData.get("contactPhone") as string | null)?.trim() || null;

  const payload = {
    org_id: (formData.get("orgId") as string | null)?.trim() ?? "",
    merchant_code: (formData.get("merchantCode") as string | null)?.trim() || null,
    reference_prefix: (formData.get("referencePrefix") as string | null)?.trim() || null,
    enabled_features: parseList(formData.get("enabledFeatures") as string | null),
    telco_ids: parseList(formData.get("telcoIds") as string | null),
    language_pack: parseList(formData.get("languagePack") as string | null),
    contact:
      contactEmail || contactPhone
        ? {
            email: contactEmail,
            phone: contactPhone,
          }
        : null,
  };

  if (!payload.org_id) {
    throw new Error("Organisation is required");
  }

  const { error } = await supabase.from("partner_config").upsert(payload);

  if (error) {
    throw error;
  }

  revalidatePath("/admin/partners");
  redirect(`/admin/partners/${payload.org_id}`);
};

export default async function NewPartnerPage() {
  const supabase = createSupabaseAdminClient();
  const { data: organizations } = await supabase
    .from("organizations")
    .select("id, name")
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-ink">Add partner configuration</h1>
        <p className="text-sm text-ink/70">
          Assign feature flags and contact metadata for a SACCO partner.
        </p>
      </header>

      <form
        action={createPartnerConfig}
        className="space-y-4 rounded-2xl border border-ink/10 bg-ink/5 p-6"
      >
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Partner organisation</span>
          <select
            name="orgId"
            required
            className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
          >
            <option value="">Select organisation…</option>
            {(organizations ?? []).map((org) => (
              <option key={org.id} value={org.id}>
                {org.name ?? org.id}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Merchant code</span>
            <input
              name="merchantCode"
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
              placeholder="e.g. 2222"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Reference prefix</span>
            <input
              name="referencePrefix"
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
              placeholder="RWA.KIGALI"
            />
          </label>
        </div>

        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Enabled features</span>
          <input
            name="enabledFeatures"
            className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
            placeholder="feature_one, feature_two"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Telco IDs</span>
            <input
              name="telcoIds"
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
              placeholder="uuid-1, uuid-2"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Language pack</span>
            <input
              name="languagePack"
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
              placeholder="en, rw"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Contact email</span>
            <input
              type="email"
              name="contactEmail"
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
              placeholder="ops@example.com"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Contact phone</span>
            <input
              name="contactPhone"
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
              placeholder="+250788000000"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <a
            href="/admin/partners"
            className="rounded-full border border-ink/20 px-5 py-2 text-sm font-semibold text-ink hover:border-ink/40"
          >
            Cancel
          </a>
          <button
            type="submit"
            className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400"
          >
            Save configuration
          </button>
        </div>
      </form>
    </div>
  );
}
