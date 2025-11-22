"use client";

import type { ReactNode } from "react";
import type { TooltipProps } from "recharts";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip,XAxis, YAxis } from "recharts";

export interface TrendAreaPoint {
  name: string;
  value: number;
  secondaryValue?: number;
}

export interface TrendAreaChartProps {
  data: TrendAreaPoint[];
  ariaLabel?: string;
  secondaryLabel?: string;
  formatTooltipValue?: (value: number) => ReactNode;
}

const tooltipStyles: TooltipProps<number, string>["contentStyle"] = {
  background: "rgba(15, 23, 42, 0.92)",
  borderRadius: "16px",
  border: "1px solid rgba(148, 163, 184, 0.25)",
  boxShadow: "0 18px 48px rgba(7, 11, 26, 0.28)",
  color: "#F8FAFC",
};

export function TrendAreaChart({ data, ariaLabel, secondaryLabel = "Comparison", formatTooltipValue }: TrendAreaChartProps) {
  return (
    <figure className="flex flex-col gap-4">
      <div className="relative h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} aria-label={ariaLabel} role="img">
            <defs>
              <linearGradient id="trendPrimary" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--ui-color-accent)" stopOpacity={0.45} />
                <stop offset="95%" stopColor="var(--ui-color-accent)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="trendSecondary" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="rgba(99, 102, 241, 0.65)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="rgba(99, 102, 241, 0.65)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.16)" strokeDasharray="6 8" />
            <XAxis dataKey="name" stroke="rgba(148, 163, 184, 0.55)" tickLine={false} axisLine={false} />
            <YAxis stroke="rgba(148, 163, 184, 0.55)" tickLine={false} axisLine={false} width={48} />
            <Tooltip
              cursor={{ stroke: "var(--ui-color-accent)", strokeWidth: 1, strokeDasharray: 4 }}
              content={({ payload, label }) => {
                if (!payload?.length) return null;
                return (
                  <div className="flex flex-col gap-2 p-3" style={tooltipStyles}>
                    <span className="text-xs uppercase tracking-[0.08em] text-[color:var(--ui-color-muted)]">{label}</span>
                    {payload.map((entry) => (
                      <span key={entry.name} className="text-sm text-[color:var(--ui-color-foreground)]">
                        {entry.name === "value" ? "Primary" : secondaryLabel}: {formatTooltipValue ? formatTooltipValue(Number(entry.value)) : entry.value}
                      </span>
                    ))}
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--ui-color-accent)"
              strokeWidth={2.5}
              fill="url(#trendPrimary)"
            />
            <Area
              type="monotone"
              dataKey="secondaryValue"
              stroke="rgba(129, 140, 248, 0.85)"
              strokeWidth={2}
              fill="url(#trendSecondary)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {ariaLabel && (
        <figcaption className="text-xs text-[color:var(--ui-color-muted)]">{ariaLabel}</figcaption>
      )}
    </figure>
  );
}
