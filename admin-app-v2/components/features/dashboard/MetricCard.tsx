import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon: LucideIcon;
  className?: string;
}

export function MetricCard({
  title,
  value,
  change,
  trend,
  icon: Icon,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("flex items-center justify-between p-6", className)}>
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <h3 className="mt-2 text-3xl font-bold text-gray-900">{value}</h3>
        {change && (
          <p
            className={cn(
              "mt-2 text-sm font-medium",
              trend === "up"
                ? "text-green-600"
                : trend === "down"
                ? "text-red-600"
                : "text-gray-600"
            )}
          >
            {change}
          </p>
        )}
      </div>
      <div className="rounded-full bg-primary-50 p-3">
        <Icon className="h-6 w-6 text-primary-600" />
      </div>
    </Card>
  );
}
