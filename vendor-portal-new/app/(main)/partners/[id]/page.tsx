import { PartnerConfigurationScreen } from "@/components/partners/partner-configuration-screen";
import { getStubCountry, getStubPartner } from "@/lib/stubs/multicountry";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function PartnerConfigPage({ params }: { params: { id: string } }) {
  const useStub = process.env.AUTH_E2E_STUB === "1";

  if (useStub) {
    const stub = getStubPartner(params.id);
    if (!stub) {
      return (
        <div className="p-6">
          <div className="text-red-500">Partner organization not found</div>
        </div>
      );
    }

    const country = getStubCountry(stub.org.country_id ?? "");

    return (
      <PartnerConfigurationScreen
        partner={{
          id: stub.org.id,
          name: stub.org.name,
          type: stub.org.type,
          country: stub.org.countries,
          districtCode: stub.org.district_code ?? null,
        }}
        config={{
          merchantCode: stub.config.merchant_code,
          referencePrefix: stub.config.reference_prefix,
          enabledFeatures: stub.config.enabled_features ?? [],
          languagePack: stub.config.language_pack ?? [],
          contact: stub.config.contact,
          updatedAt: stub.config.updated_at,
        }}
        telcos={stub.telcos.map((telco) => ({
          id: telco.id,
          name: telco.name,
          ussd_pattern: telco.ussd_pattern,
        }))}
        availableLanguages={country?.config.languages ?? []}
      />
    );
  }

  const supa = createSupabaseAdminClient();
  const { data: org } = await supa
    .from("organizations")
    .select("id, name, type, country_id, district_code, countries(name, iso2)")
    .eq("id", params.id)
    .maybeSingle();

  if (!org) {
    return (
      <div className="p-6">
        <div className="text-red-500">Partner organization not found</div>
      </div>
    );
  }

  const { data: cfg } = await supa
    .from("partner_config")
    .select(
      "org_id, merchant_code, reference_prefix, enabled_features, language_pack, contact, updated_at"
    )
    .eq("org_id", params.id)
    .maybeSingle();

  const { data: countryConfig } = await supa
    .from("country_config")
    .select("languages")
    .eq("country_id", org.country_id)
    .maybeSingle();

  const { data: telcos } = await supa
    .from("telco_providers")
    .select("id, name, ussd_pattern")
    .eq("country_id", org.country_id);

  const config = {
    merchantCode: cfg?.merchant_code ?? null,
    referencePrefix: cfg?.reference_prefix ?? null,
    enabledFeatures: (cfg?.enabled_features ?? []) as string[],
    languagePack: (cfg?.language_pack ?? []) as string[],
    contact: cfg?.contact ?? null,
    updatedAt: cfg?.updated_at ?? null,
  };

  return (
    <PartnerConfigurationScreen
      partner={{
        id: org.id,
        name: org.name,
        type: org.type,
        country: org.countries ?? null,
        districtCode: org.district_code ?? null,
      }}
      config={config}
      telcos={(telcos ?? []) as Array<{ id: string; name: string; ussd_pattern: string }>}
      availableLanguages={((countryConfig?.languages ?? []) as string[]) ?? []}
    />
  );
}
