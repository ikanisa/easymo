import { Badge } from "@/components/ui/Badge";

interface ParserBadgeProps {
  parser: "openai" | "gemini" | "regex" | null;
}

export function ParserBadge({ parser }: ParserBadgeProps) {
  if (!parser) return <span className="text-gray-400">—</span>;

  const variants = {
    openai: {
      label: "OpenAI",
      className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      icon: "🤖",
    },
    gemini: {
      label: "Gemini",
      className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      icon: "✨",
    },
    regex: {
      label: "Regex",
      className: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
      icon: "📝",
    },
  };

  const variant = variants[parser];

  return (
    <Badge className={variant.className}>
      <span className="mr-1">{variant.icon}</span>
      {variant.label}
    </Badge>
  );
}
