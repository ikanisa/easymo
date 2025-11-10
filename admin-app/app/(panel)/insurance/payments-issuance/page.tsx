import { PageHeader } from "@/components/layout/PageHeader";
import { PaymentsIssuanceBoard } from "@/components/insurance/PaymentsIssuanceBoard";

export default function InsurancePaymentsIssuancePage() {
  return (
    <div className="admin-page">
      <PageHeader
        title="Payments & issuance"
        description="Monitor MoMo confirmations, reconcile settlements, and orchestrate policy issuance packages."
      />
      <PaymentsIssuanceBoard />
    </div>
  );
}
