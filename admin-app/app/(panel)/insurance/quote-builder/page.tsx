import { PageHeader } from "@/components/layout/PageHeader";
import { NewRequestWizard } from "@/components/insurance/NewRequestWizard";
import { InsuranceComparisonsBoard } from "@/components/insurance/InsuranceComparisonsBoard";

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
