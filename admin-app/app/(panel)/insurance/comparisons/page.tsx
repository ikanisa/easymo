import { PageHeader } from "@/components/layout/PageHeader";
import { InsuranceComparisonsBoard } from "@/components/insurance/InsuranceComparisonsBoard";

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
