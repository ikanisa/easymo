"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Check, X, Clock, Loader2 } from "lucide-react";
import { useInsuranceLeads } from "@/lib/hooks/useData";
import { formatDistanceToNow } from "@/lib/utils";

interface Lead {
  id: string;
  customerName: string;
  type: "motor" | "health" | "life";
  status: "new" | "reviewing" | "contacted";
  submittedAt: string;
  details: string;
}

export function LeadsQueue() {
  const { data, isLoading, error } = useInsuranceLeads();
  const leads: Lead[] = (data as { leads?: Lead[] })?.leads || [];

  return (
    <Card className="h-full p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Leads Queue</h3>
        <Badge variant="secondary">
          {isLoading ? "..." : leads.length} Pending
        </Badge>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {error && (
        <div className="text-center py-8 text-red-500">
          Failed to load leads
        </div>
      )}

      {!isLoading && !error && leads.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No pending leads
        </div>
      )}

      <div className="space-y-4">
        {leads.map((lead) => (
          <div
            key={lead.id}
            className="flex items-start justify-between p-4 rounded-lg border bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex gap-4">
              <div className="mt-1">
                <Avatar fallback={lead.customerName} />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">{lead.customerName}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="capitalize text-xs">
                    {lead.type}
                  </Badge>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> 
                    {lead.submittedAt ? formatDistanceToNow(lead.submittedAt) : 'Unknown'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-2">{lead.details}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button size="sm" variant="ghost" className="text-green-600 hover:text-green-700 hover:bg-green-50">
                <Check className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
