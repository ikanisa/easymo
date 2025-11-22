import { InsuranceComparisonsBoard } from "@/components/insurance/InsuranceComparisonsBoard";
import { PageHeader } from "@/components/layout/PageHeader";

export default function InsuranceComparisonsPage() {
  return (
    <div className="admin-page">
      <PageHeader
        title="Comparisons"
        description="Coach agents through premium and SLA trade-offs across partner insurers."
      />
      <InsuranceComparisonsBoard />
    </div>
  );
}
export const dynamic = "force-dynamic";
