import { CountryConfigurationScreen } from "@/components/countries/country-configuration-screen";
import { getStubCountry } from "@/lib/stubs/multicountry";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function CountryConfigPage({ params }: { params: { id: string } }) {
  const useStub = process.env.AUTH_E2E_STUB === "1";

  if (useStub) {
    const stub = getStubCountry(params.id);
    if (!stub) {
      return (
        <div className="p-6">
          <div className="text-red-500">Country not found</div>
        </div>
      );
    }

    return (
      <CountryConfigurationScreen
        country={stub.country}
        config={{
          referenceFormat: stub.config.reference_format,
          settlementNotes: stub.config.settlement_notes,
          enabledFeatures: stub.config.enabled_features,
          updatedAt: stub.config.updated_at,
          languages: stub.config.languages,
        }}
        telcos={stub.telcos}
      />
    );
  }

  const supa = createSupabaseAdminClient();
  const { data: country } = await supa
    .from("countries")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!country) {
    return (
      <div className="p-6">
        <div className="text-red-500">Country not found</div>
      </div>
    );
  }

  const { data: cfg } = await supa
    .from("country_config")
    .select(
      "country_id, languages, enabled_features, reference_format, settlement_notes, updated_at"
    )
    .eq("country_id", params.id)
    .maybeSingle();

  const { data: telcos } = await supa
    .from("telco_providers")
    .select("id, name, ussd_pattern")
    .eq("country_id", params.id);

  const config = {
    referenceFormat: cfg?.reference_format ?? "C3.D3.S3.G4.M3",
    settlementNotes: cfg?.settlement_notes ?? "",
    enabledFeatures: (cfg?.enabled_features ?? []) as string[],
    updatedAt: cfg?.updated_at ?? null,
    languages: (cfg?.languages ?? []) as string[],
  };

  return (
    <CountryConfigurationScreen
      country={country}
      config={config}
      telcos={(telcos ?? []) as Array<{ id: string; name: string; ussd_pattern: string }>}
    />
  );
}
