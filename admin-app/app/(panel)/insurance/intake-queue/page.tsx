import { PageHeader } from "@/components/layout/PageHeader";
import { IntakeQueue } from "@/components/insurance/IntakeQueue";

export default function InsuranceIntakeQueuePage() {
  return (
    <div className="admin-page">
      <PageHeader
        title="Intake queue"
        description="Centralize new WhatsApp, partner, and agent submissions with OCR confidence tracking."
      />
      <IntakeQueue />
    </div>
  );
}
