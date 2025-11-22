import { InsuranceComparisonsBoard } from "@/components/insurance/InsuranceComparisonsBoard";
import { NewRequestWizard } from "@/components/insurance/NewRequestWizard";
import { PageHeader } from "@/components/layout/PageHeader";

export default function InsuranceQuoteBuilderPage() {
  return (
    <div className="admin-page">
      <PageHeader
        title="Quote builder"
        description="Upload, price, compare, and prepare issuance from a single collaborative workspace."
      />
      <div className="space-y-6">
        <NewRequestWizard />
        <InsuranceComparisonsBoard />
      </div>
    </div>
  );
}
export const dynamic = "force-dynamic";
