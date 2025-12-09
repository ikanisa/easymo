import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const parseList = (value: string | null): string[] | null => {
  if (!value) return null;
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : null;
};

const updatePartnerConfig = async (formData: FormData) => {
  "use server";

  const orgId = (formData.get("orgId") as string | null)?.trim();
  if (!orgId) {
    throw new Error("Missing organisation");
  }

  const contactEmail = (formData.get("contactEmail") as string | null)?.trim() || null;
  const contactPhone = (formData.get("contactPhone") as string | null)?.trim() || null;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("partner_config").upsert(
    {
      org_id: orgId,
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
    },
    { onConflict: "org_id" }
  );

  if (error) {
    throw error;
  }

  revalidatePath("/admin/partners");
};

export default async function EditPartnerPage({ params }: { params: { orgId: string } }) {
  const supabase = createSupabaseAdminClient();
  const { data: partner, error } = await supabase
    .from("partner_config")
    .select(
      "org_id, merchant_code, reference_prefix, enabled_features, telco_ids, language_pack, contact"
    )
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (error || !partner) {
    notFound();
  }

  const enabledFeatures = partner.enabled_features?.join(", ") ?? "";
  const telcoIds = partner.telco_ids?.join(", ") ?? "";
  const languagePack = partner.language_pack?.join(", ") ?? "";
  const contactEmail =
    typeof partner.contact === "object" && partner.contact !== null
      ? (((partner.contact as Record<string, unknown>).email as string | null) ?? "")
      : "";
  const contactPhone =
    typeof partner.contact === "object" && partner.contact !== null
      ? (((partner.contact as Record<string, unknown>).phone as string | null) ?? "")
      : "";

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-ink">Partner configuration</h1>
        <p className="text-sm text-ink/70">
          Manage feature flags and telco routing for this partner.
        </p>
      </header>

      <form
        action={updatePartnerConfig}
        className="space-y-4 rounded-2xl border border-ink/10 bg-ink/5 p-6"
      >
        <input type="hidden" name="orgId" value={partner.org_id} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Merchant code</span>
            <input
              name="merchantCode"
              defaultValue={partner.merchant_code ?? ""}
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Reference prefix</span>
            <input
              name="referencePrefix"
              defaultValue={partner.reference_prefix ?? ""}
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
            />
          </label>
        </div>

        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Enabled features</span>
          <input
            name="enabledFeatures"
            defaultValue={enabledFeatures}
            className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Telco IDs</span>
            <input
              name="telcoIds"
              defaultValue={telcoIds}
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Language pack</span>
            <input
              name="languagePack"
              defaultValue={languagePack}
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Contact email</span>
            <input
              type="email"
              name="contactEmail"
              defaultValue={contactEmail ?? ""}
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Contact phone</span>
            <input
              name="contactPhone"
              defaultValue={contactPhone ?? ""}
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
            />
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400"
          >
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
