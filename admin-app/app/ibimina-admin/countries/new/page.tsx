import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const createCountry = async (formData: FormData) => {
  "use server";

  const supabase = createSupabaseAdminClient();
  const payload = {
    name: (formData.get("name") as string | null)?.trim() ?? "",
    iso2: (formData.get("iso2") as string | null)?.trim().toUpperCase() ?? "",
    iso3: (formData.get("iso3") as string | null)?.trim().toUpperCase() ?? "",
    default_locale: (formData.get("defaultLocale") as string | null)?.trim() ?? "en-RW",
    currency_code: (formData.get("currencyCode") as string | null)?.trim().toUpperCase() ?? "RWF",
    timezone: (formData.get("timezone") as string | null)?.trim() ?? "Africa/Kigali",
    is_active: formData.get("isActive") === "on",
  };

  const { data, error } = await supabase
    .from("countries")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  revalidatePath("/admin/countries");
  redirect(`/admin/countries/${data?.id ?? ""}`);
};

export default function NewCountryPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-ink">Add country</h1>
        <p className="text-sm text-ink/70">
          Register a new market for SACCO+. Configure locales, currency, and timezone defaults.
        </p>
      </header>

      <form
        action={createCountry}
        className="space-y-4 rounded-2xl border border-ink/10 bg-ink/5 p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Country name</span>
            <input
              name="name"
              required
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
              placeholder="Rwanda"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">ISO2</span>
            <input
              name="iso2"
              required
              maxLength={2}
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm uppercase text-ink focus:border-emerald-400 focus:outline-none"
              placeholder="RW"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">ISO3</span>
            <input
              name="iso3"
              required
              maxLength={3}
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm uppercase text-ink focus:border-emerald-400 focus:outline-none"
              placeholder="RWA"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Default locale</span>
            <input
              name="defaultLocale"
              defaultValue="en-RW"
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
              placeholder="en-RW"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Currency code</span>
            <input
              name="currencyCode"
              defaultValue="RWF"
              maxLength={3}
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm uppercase text-ink focus:border-emerald-400 focus:outline-none"
              placeholder="RWF"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Timezone</span>
            <input
              name="timezone"
              defaultValue="Africa/Kigali"
              className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
              placeholder="Africa/Kigali"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked
            className="h-4 w-4 rounded border-ink/30"
          />
          <span>Country is active</span>
        </label>

        <div className="flex justify-end gap-2">
          <a
            href="/admin/countries"
            className="rounded-full border border-ink/20 px-5 py-2 text-sm font-semibold text-ink hover:border-ink/40"
          >
            Cancel
          </a>
          <button
            type="submit"
            className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400"
          >
            Create country
          </button>
        </div>
      </form>
    </div>
  );
}
