interface StatusChipProps {
  children: React.ReactNode;
  tone?: "neutral" | "info" | "success" | "warning" | "critical";
}

export function StatusChip({ children, tone = "neutral" }: StatusChipProps) {
  const toneClasses: Record<NonNullable<StatusChipProps["tone"]>, string> = {
    neutral: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    info: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    success: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    warning: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-wide ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}
