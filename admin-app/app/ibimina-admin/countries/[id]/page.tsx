import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const updateCountry = async (formData: FormData) => {
  "use server";

  const id = (formData.get("id") as string | null)?.trim();
  if (!id) {
    throw new Error("Missing country id");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("countries")
    .update({
      name: (formData.get("name") as string | null)?.trim() ?? undefined,
      iso2: (formData.get("iso2") as string | null)?.trim().toUpperCase() ?? undefined,
      iso3: (formData.get("iso3") as string | null)?.trim().toUpperCase() ?? undefined,
      default_locale: (formData.get("defaultLocale") as string | null)?.trim() ?? undefined,
      currency_code:
        (formData.get("currencyCode") as string | null)?.trim().toUpperCase() ?? undefined,
      timezone: (formData.get("timezone") as string | null)?.trim() ?? undefined,
      is_active: formData.get("isActive") === "on",
    })
    .eq("id", id);

  if (error) {
    throw error;
  }

  revalidatePath("/admin/countries");
};

export default async function EditCountryPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseAdminClient();
  const { data: country, error } = await supabase
    .from("countries")
    .select("id, name, iso2, iso3, default_locale, currency_code, timezone, is_active")
    .eq("id", params.id)
    .maybeSingle();

  if (error || !country) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-ink">{country.name}</h1>
        <p className="text-sm text-ink/70">
          Manage locale, currency, and availability for this country.
        </p>
      </header>

      <form
        action={updateCountry}
        className="space-y-4 rounded-2xl border border-ink/10 bg-ink/5 p-6"
      >
        <input type="hidden" name="id" value={country.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Country name</span>
            <input
              name="name"
              defaultValue={country.name ?? ""}
              required
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">ISO2</span>
            <input
              name="iso2"
              defaultValue={country.iso2 ?? ""}
              required
              maxLength={2}
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm uppercase text-ink focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">ISO3</span>
            <input
              name="iso3"
              defaultValue={country.iso3 ?? ""}
              required
              maxLength={3}
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm uppercase text-ink focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Default locale</span>
            <input
              name="defaultLocale"
              defaultValue={country.default_locale ?? ""}
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Currency code</span>
            <input
              name="currencyCode"
              defaultValue={country.currency_code ?? ""}
              maxLength={3}
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm uppercase text-ink focus:border-emerald-400 focus:outline-none"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Timezone</span>
            <input
              name="timezone"
              defaultValue={country.timezone ?? ""}
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={country.is_active}
            className="h-4 w-4 rounded border-ink/30"
          />
          <span>Country is active</span>
        </label>

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
