import { DocumentsLibrary } from "@/components/insurance/DocumentsLibrary";
import { PageHeader } from "@/components/layout/PageHeader";

export default function InsuranceDocumentsPage() {
  return (
    <div className="admin-page">
      <PageHeader
        title="Documents library"
        description="Verify OCR confidence, signed policies, and attachments across the insurance lifecycle."
      />
      <DocumentsLibrary />
    </div>
  );
}
export const dynamic = "force-dynamic";
