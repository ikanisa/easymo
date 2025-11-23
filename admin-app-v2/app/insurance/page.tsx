"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { LeadsQueue } from "@/components/features/insurance/LeadsQueue";
import { PolicyCard } from "@/components/features/insurance/PolicyCard";
import { ContactManager } from "@/components/features/insurance/ContactManager";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";

const mockPolicies = [
  {
    id: "1",
    policyNumber: "POL-2023-001",
    holderName: "John Doe",
    type: "Motor Comprehensive",
    status: "active" as const,
    expiryDate: "2024-11-23",
    premium: "RWF 150,000",
  },
  {
    id: "2",
    policyNumber: "POL-2023-002",
    holderName: "Jane Smith",
    type: "Health Family",
    status: "pending" as const,
    expiryDate: "2024-12-01",
    premium: "RWF 45,000",
  },
];

export default function InsurancePage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Insurance Operations</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage leads, policies, and support contacts.
            </p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Policy
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Leads & Contacts */}
          <div className="space-y-6">
            <LeadsQueue />
            <ContactManager />
          </div>

          {/* Right Column - Policies */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Recent Policies</h3>
              <Button variant="link" className="text-primary-600">View All</Button>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              {mockPolicies.map((policy) => (
                <PolicyCard key={policy.id} policy={policy} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

