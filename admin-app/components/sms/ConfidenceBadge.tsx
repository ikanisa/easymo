interface ConfidenceBadgeProps {
  confidence: number | null;
}

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  if (confidence === null) return <span className="text-gray-400">—</span>;

  const percentage = Math.round(confidence * 100);
  
  let colorClass = "text-red-500";
  if (percentage >= 90) colorClass = "text-green-500";
  else if (percentage >= 70) colorClass = "text-yellow-500";
  else if (percentage >= 50) colorClass = "text-orange-500";

  return (
    <span className={`font-medium ${colorClass}`}>
      {percentage}%
    </span>
  );
}
