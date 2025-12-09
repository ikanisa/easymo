import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const updateTelco = async (formData: FormData) => {
  "use server";

  const id = (formData.get("id") as string | null)?.trim();
  if (!id) {
    throw new Error("Missing provider id");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("telco_providers")
    .update({
      name: (formData.get("name") as string | null)?.trim() ?? undefined,
      country_id: (formData.get("countryId") as string | null)?.trim() || null,
      ussd_pattern: (formData.get("ussdPattern") as string | null)?.trim() || null,
      merchant_field_name: (formData.get("merchantField") as string | null)?.trim() || null,
      reference_field_name: (formData.get("referenceField") as string | null)?.trim() || null,
    })
    .eq("id", id);

  if (error) {
    throw error;
  }

  revalidatePath("/admin/telcos");
};

export default async function EditTelcoPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseAdminClient();
  const [{ data: telco, error }, { data: countries }] = await Promise.all([
    supabase
      .from("telco_providers")
      .select("id, name, country_id, ussd_pattern, merchant_field_name, reference_field_name")
      .eq("id", params.id)
      .maybeSingle(),
    supabase.from("countries").select("id, name").order("name", { ascending: true }),
  ]);

  if (error || !telco) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-ink">{telco.name}</h1>
        <p className="text-sm text-ink/70">Update USSD mapping details for this telco provider.</p>
      </header>

      <form
        action={updateTelco}
        className="space-y-4 rounded-2xl border border-ink/10 bg-ink/5 p-6"
      >
        <input type="hidden" name="id" value={telco.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Provider name</span>
            <input
              name="name"
              defaultValue={telco.name ?? ""}
              required
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Country</span>
            <select
              name="countryId"
              defaultValue={telco.country_id ?? ""}
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
            defaultValue={telco.ussd_pattern ?? ""}
            className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm font-mono text-ink focus:border-emerald-400 focus:outline-none"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Merchant field key</span>
            <input
              name="merchantField"
              defaultValue={telco.merchant_field_name ?? ""}
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Reference field key</span>
            <input
              name="referenceField"
              defaultValue={telco.reference_field_name ?? ""}
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
