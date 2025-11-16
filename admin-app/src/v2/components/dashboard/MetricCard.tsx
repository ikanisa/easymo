import type { ReactNode } from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: string;
  icon: ReactNode;
}

export function MetricCard({ title, value, trend, icon }: MetricCardProps) {
  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm" aria-label={title}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-500">{title}</h3>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          {icon}
        </div>
      </div>
      {trend && <p className="mt-4 text-sm font-medium text-green-600">{trend}</p>}
    </article>
  );
}
