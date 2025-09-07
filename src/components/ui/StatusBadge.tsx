import { Badge } from "@/components/ui/badge";
import type { Subscription } from "@/lib/types";

interface StatusBadgeProps {
  status: Subscription["status"];
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStatusColor = (status: Subscription["status"]) => {
    switch (status) {
      case "active": return "bg-success";
      case "pending_review": return "bg-warning";
      case "expired": return "bg-muted";
      case "rejected": return "bg-destructive";
      default: return "bg-muted";
    }
  };

  return (
    <Badge variant="secondary" className={`${getStatusColor(status)} ${className}`}>
      {status.replace("_", " ")}
    </Badge>
  );
}