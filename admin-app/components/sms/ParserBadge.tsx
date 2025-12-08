import { Badge } from "@/components/ui/Badge";

interface ParserBadgeProps {
  parser: "openai" | "gemini" | "regex" | null;
}

export function ParserBadge({ parser }: ParserBadgeProps) {
  if (!parser) return <span className="text-gray-400">—</span>;

  const variants = {
    openai: {
      label: "OpenAI",
      variant: "green" as const,
      icon: "🤖",
    },
    gemini: {
      label: "Gemini",
      variant: "blue" as const,
      icon: "✨",
    },
    regex: {
      label: "Regex",
      variant: "gray" as const,
      icon: "📝",
    },
  };

  const config = variants[parser];

  return (
    <Badge variant={config.variant}>
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </Badge>
  );
}
