import { Card } from "@/components/ui/Card";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface InsightCardProps {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
  description: string;
}

export function InsightCard({
  title,
  value,
  change,
  trend,
  description,
}: InsightCardProps) {
  return (
    <Card className="p-6">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
        <span
          className={cn(
            "flex items-center text-sm font-medium",
            trend === "up"
              ? "text-green-600"
              : trend === "down"
              ? "text-red-600"
              : "text-gray-600"
          )}
        >
          {trend === "up" ? (
            <ArrowUpRight className="mr-1 h-4 w-4" />
          ) : trend === "down" ? (
            <ArrowDownRight className="mr-1 h-4 w-4" />
          ) : (
            <Minus className="mr-1 h-4 w-4" />
          )}
          {change}
        </span>
      </div>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
    </Card>
  );
}
