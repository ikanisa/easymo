import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
    size?: "default" | "sm" | "lg" | "icon";
  };
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      {action && (
        <Button
          onClick={action.onClick}
          variant={action.variant || "outline"}
          size={action.size || "sm"}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}