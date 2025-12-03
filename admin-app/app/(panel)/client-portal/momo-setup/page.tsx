"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { MomoSetupForm } from "@/components/client-portal/MomoSetupForm";
import type { SupportedCountryCode } from "@/lib/countries/types";
import { DEFAULT_COUNTRY_CODE } from "@/lib/countries/types";

export default function MomoSetupPage() {
  const router = useRouter();

  const handleSave = async (data: {
    countryCode: SupportedCountryCode;
    phoneNumber: string;
  }) => {
    // TODO: Save to Supabase
    console.log("Saving MoMo config:", data);
    
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // Navigate back to profile
    router.push("/client-portal/profile");
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="admin-page">
      <PageHeader
        title="Mobile Money Setup"
        description="Configure your mobile money account for receiving payments"
      />

      <div className="max-w-md mx-auto">
        <div className="bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl p-6">
          <MomoSetupForm
            initialCountry={DEFAULT_COUNTRY_CODE}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </div>
  );
}
