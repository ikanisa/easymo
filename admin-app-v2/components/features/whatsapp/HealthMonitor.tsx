import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface HealthStatus {
  service: string;
  status: "healthy" | "degraded" | "down";
  latency: string;
  lastChecked: string;
}

const services: HealthStatus[] = [
  {
    service: "WhatsApp API",
    status: "healthy",
    latency: "45ms",
    lastChecked: "Just now",
  },
  {
    service: "Webhook Handler",
    status: "healthy",
    latency: "120ms",
    lastChecked: "1m ago",
  },
  {
    service: "Message Queue",
    status: "degraded",
    latency: "450ms",
    lastChecked: "2m ago",
  },
];

export function HealthMonitor() {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900">System Health</h3>
      <div className="mt-6 space-y-4">
        {services.map((service) => (
          <div
            key={service.service}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div className="flex items-center gap-3">
              {service.status === "healthy" ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : service.status === "degraded" ? (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <div>
                <p className="font-medium text-gray-900">{service.service}</p>
                <p className="text-sm text-gray-500">
                  Last checked: {service.lastChecked}
                </p>
              </div>
            </div>
            <div className="text-right">
              <Badge
                variant={
                  service.status === "healthy"
                    ? "success"
                    : service.status === "degraded"
                    ? "warning"
                    : "destructive"
                }
                className="capitalize"
              >
                {service.status}
              </Badge>
              <p className="mt-1 text-sm text-gray-500">{service.latency}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
