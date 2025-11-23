import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FileText, Download, ExternalLink } from "lucide-react";

interface Policy {
  id: string;
  policyNumber: string;
  holderName: string;
  type: string;
  status: "active" | "expired" | "pending";
  expiryDate: string;
  premium: string;
}

interface PolicyCardProps {
  policy: Policy;
}

export function PolicyCard({ policy }: PolicyCardProps) {
  return (
    <Card className="p-6">
      <div className="flex justify-between items-start">
        <div className="flex gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">{policy.type} Insurance</h4>
            <p className="text-sm text-gray-500">#{policy.policyNumber}</p>
          </div>
        </div>
        <Badge
          variant={
            policy.status === "active"
              ? "success"
              : policy.status === "pending"
              ? "warning"
              : "destructive"
          }
          className="capitalize"
        >
          {policy.status}
        </Badge>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-500">Holder</p>
          <p className="font-medium text-gray-900">{policy.holderName}</p>
        </div>
        <div>
          <p className="text-gray-500">Premium</p>
          <p className="font-medium text-gray-900">{policy.premium}</p>
        </div>
        <div>
          <p className="text-gray-500">Expires</p>
          <p className="font-medium text-gray-900">{policy.expiryDate}</p>
        </div>
      </div>

      <div className="mt-6 flex gap-3 pt-4 border-t">
        <Button variant="secondary" size="sm" className="flex-1">
          <Download className="w-4 h-4 mr-2" />
          Download
        </Button>
        <Button variant="ghost" size="sm" className="flex-1">
          <ExternalLink className="w-4 h-4 mr-2" />
          View Details
        </Button>
      </div>
    </Card>
  );
}
