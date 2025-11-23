"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Check, X, Clock } from "lucide-react";

interface Lead {
  id: string;
  customerName: string;
  type: "motor" | "health" | "life";
  status: "new" | "reviewing" | "contacted";
  submittedAt: string;
  details: string;
}

const mockLeads: Lead[] = [
  {
    id: "1",
    customerName: "Alice Johnson",
    type: "motor",
    status: "new",
    submittedAt: "10m ago",
    details: "Toyota RAV4 2020, Comprehensive",
  },
  {
    id: "2",
    customerName: "Bob Smith",
    type: "health",
    status: "reviewing",
    submittedAt: "1h ago",
    details: "Family Plan, 4 members",
  },
  {
    id: "3",
    customerName: "Charlie Brown",
    type: "motor",
    status: "contacted",
    submittedAt: "2h ago",
    details: "Honda CRV 2018, Third Party",
  },
];

export function LeadsQueue() {
  return (
    <Card className="h-full p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Leads Queue</h3>
        <Badge variant="secondary">{mockLeads.length} Pending</Badge>
      </div>

      <div className="space-y-4">
        {mockLeads.map((lead) => (
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
                    <Clock className="w-3 h-3" /> {lead.submittedAt}
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
