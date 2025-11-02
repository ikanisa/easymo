"use client";

import type { HTMLAttributes } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface SparklineDatum {
  label: string;
  value: number;
}

export interface SparklineChartProps extends HTMLAttributes<HTMLDivElement> {
  data: SparklineDatum[];
  /**
   * Accessible label for the chart region.
   */
  "aria-label": string;
  /**
   * Optional description rendered below the chart for context.
   */
  description?: string;
}

export function SparklineChart({
  data,
  description,
  className,
  ...rest
}: SparklineChartProps) {
  const { ["aria-label"]: ariaLabel, ...restProps } = rest;
  return (
    <figure className={className} aria-label={ariaLabel} {...restProps}>
      <div className="h-48 w-full rounded-xl border border-[color:rgba(var(--easymo-colors-neutral-200),0.6)] bg-[color:rgba(var(--easymo-colors-neutral-50),0.7)] p-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} aria-label={ariaLabel} role="img">
            <defs>
              <linearGradient id="sparklineGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="rgb(var(--easymo-colors-primary-500))" stopOpacity={0.65} />
                <stop offset="95%" stopColor="rgb(var(--easymo-colors-primary-500))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "rgba(15, 23, 42, 0.45)", fontSize: 12 }}
            />
            <YAxis
              width={0}
              tickLine={false}
              axisLine={false}
              tick={false}
              domain={["auto", "auto"]}
            />
            <Tooltip
              cursor={{ stroke: "rgba(14, 165, 233, 0.4)", strokeWidth: 2 }}
              contentStyle={{
                borderRadius: "0.75rem",
                border: "1px solid rgba(14, 165, 233, 0.3)",
                background: "rgba(248, 250, 252, 0.92)",
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="rgb(var(--easymo-colors-primary-500))"
              strokeWidth={2.8}
              fill="url(#sparklineGradient)"
              aria-hidden
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {description ? (
        <figcaption className="mt-3 text-sm text-[color:rgb(var(--easymo-colors-neutral-600))]">
          {description}
        </figcaption>
      ) : null}
    </figure>
  );
}
