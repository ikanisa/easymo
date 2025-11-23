import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MoreHorizontal } from "lucide-react";

interface Partner {
  id: string;
  name: string;
  category: string;
  balance: string;
  status: "active" | "inactive";
}

const mockPartners: Partner[] = [
  {
    id: "1",
    name: "Total Energies",
    category: "Fuel Station",
    balance: "50,000",
    status: "active",
  },
  {
    id: "2",
    name: "Simba Supermarket",
    category: "Retail",
    balance: "12,500",
    status: "active",
  },
  {
    id: "3",
    name: "Kigali Heights",
    category: "Mall",
    balance: "0",
    status: "inactive",
  },
];

export function PartnerList() {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Token Partners</h3>
        <Button size="sm" variant="secondary">View All</Button>
      </div>

      <div className="space-y-4">
        {mockPartners.map((partner) => (
          <div
            key={partner.id}
            className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Avatar fallback={partner.name} />
              <div>
                <h4 className="font-medium text-gray-900">{partner.name}</h4>
                <p className="text-xs text-gray-500">{partner.category}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-900">{partner.balance}</p>
              <Badge
                variant={partner.status === "active" ? "success" : "secondary"}
                className="capitalize text-xs mt-1"
              >
                {partner.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
