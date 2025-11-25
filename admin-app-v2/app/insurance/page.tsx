"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { LeadsQueue } from "@/components/features/insurance/LeadsQueue";
import { PolicyCard } from "@/components/features/insurance/PolicyCard";
import { ContactManager } from "@/components/features/insurance/ContactManager";
import { Button } from "@/components/ui/Button";
import { Plus, Loader2 } from "lucide-react";
import { useInsurancePolicies } from "@/lib/hooks/useData";

interface Policy {
  id: string;
  policyNumber: string;
  holderName: string;
  type: string;
  status: "active" | "expired" | "pending";
  expiryDate: string;
  premium: string;
}

export default function InsurancePage() {
  const { data, isLoading, error } = useInsurancePolicies();
  const rawPolicies = (data as { policies?: Array<{
    id: string;
    policyNumber: string;
    holderName: string;
    insurer?: string;
    status: string;
    validUntil?: string;
  }> })?.policies || [];
  
  // Transform policies to match expected format
  const policies: Policy[] = rawPolicies.slice(0, 4).map((p) => ({
    id: p.id,
    policyNumber: p.policyNumber || 'N/A',
    holderName: p.holderName || 'Unknown',
    type: p.insurer || 'Motor Comprehensive',
    status: (p.status as "active" | "expired" | "pending") || 'pending',
    expiryDate: p.validUntil ? new Date(p.validUntil).toLocaleDateString() : 'N/A',
    premium: 'RWF -', // Premium not stored in current schema
  }));

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
            
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            )}
            
            {error && (
              <div className="text-center py-12 text-red-500">
                Failed to load policies
              </div>
            )}
            
            {!isLoading && !error && policies.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No policies found. Create a new policy to get started.
              </div>
            )}
            
            <div className="grid gap-6 sm:grid-cols-2">
              {policies.map((policy) => (
                <PolicyCard key={policy.id} policy={policy} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
