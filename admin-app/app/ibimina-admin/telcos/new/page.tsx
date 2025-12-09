import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const createTelco = async (formData: FormData) => {
  "use server";

  const supabase = createSupabaseAdminClient();
  const payload = {
    name: (formData.get("name") as string | null)?.trim() ?? "",
    country_id: (formData.get("countryId") as string | null)?.trim() || null,
    ussd_pattern: (formData.get("ussdPattern") as string | null)?.trim() || null,
    merchant_field_name: (formData.get("merchantField") as string | null)?.trim() || null,
    reference_field_name: (formData.get("referenceField") as string | null)?.trim() || null,
  };

  const { data, error } = await supabase
    .from("telco_providers")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  revalidatePath("/admin/telcos");
  redirect(`/admin/telcos/${data?.id ?? ""}`);
};

export default async function NewTelcoPage() {
  const supabase = createSupabaseAdminClient();
  const { data: countries } = await supabase
    .from("countries")
    .select("id, name")
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-ink">Add telco provider</h1>
        <p className="text-sm text-ink/70">
          Configure a new mobile money integration and USSD parsing rules.
        </p>
      </header>

      <form
        action={createTelco}
        className="space-y-4 rounded-2xl border border-ink/10 bg-ink/5 p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Provider name</span>
            <input
              name="name"
              required
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
              placeholder="MTN Rwanda"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Country</span>
            <select
              name="countryId"
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
            >
              <option value="">Unassigned</option>
              {(countries ?? []).map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">USSD pattern</span>
          <textarea
            name="ussdPattern"
            rows={3}
            className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm font-mono text-ink focus:border-emerald-400 focus:outline-none"
            placeholder="e.g. ^\*182\*8\*1\*(?<merchant>\d+)#"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Merchant field key</span>
            <input
              name="merchantField"
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
              placeholder="merchant"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Reference field key</span>
            <input
              name="referenceField"
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
              placeholder="reference"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <a
            href="/admin/telcos"
            className="rounded-full border border-ink/20 px-5 py-2 text-sm font-semibold text-ink hover:border-ink/40"
          >
            Cancel
          </a>
          <button
            type="submit"
            className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400"
          >
            Create provider
          </button>
        </div>
      </form>
    </div>
  );
}
