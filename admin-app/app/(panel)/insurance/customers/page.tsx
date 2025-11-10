import { PageHeader } from "@/components/layout/PageHeader";
import { CustomersDirectory } from "@/components/insurance/CustomersDirectory";

export default function InsuranceCustomersPage() {
  return (
    <div className="admin-page">
      <PageHeader
        title="Customers"
        description="Understand every customer's insurance history, docs footprint, and outstanding actions."
      />
      <CustomersDirectory />
    </div>
  );
}
