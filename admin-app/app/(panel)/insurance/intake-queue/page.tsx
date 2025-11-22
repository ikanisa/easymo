import { IntakeQueue } from "@/components/insurance/IntakeQueue";
import { PageHeader } from "@/components/layout/PageHeader";

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
