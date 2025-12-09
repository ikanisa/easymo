import { cn } from "../utils/cn";

type TrendPoint = {
  label: string;
  value: number;
};

const toneClasses: Record<"emerald" | "amber" | "cyan", string> = {
  emerald: "text-emerald-300",
  amber: "text-amber-300",
  cyan: "text-cyan-300",
};

interface SparklineProps {
  series: TrendPoint[];
  ariaLabel: string;
  tone?: "emerald" | "amber" | "cyan";
  className?: string;
}

export function Sparkline({ series, ariaLabel, tone = "emerald", className }: SparklineProps) {
  const cleanSeries = series.filter((point) => Number.isFinite(point.value));
  const plotted = cleanSeries.length > 0 ? cleanSeries : [{ label: "—", value: 0 }];

  const values = plotted.map((point) => point.value);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);

  const width = 100;
  const height = 32;
  const step = plotted.length > 1 ? width / (plotted.length - 1) : width;

  const points = plotted.map((point, index) => {
    const x = Math.max(0, Math.min(width, index * step));
    const normalized = (point.value - min) / range;
    const y = height - normalized * height;
    return { x, y };
  });

  const pointList = points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const lastPoint = points.at(-1);

  return (
    <figure className={cn("flex flex-col", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        className={cn("h-full w-full", toneClasses[tone])}
      >
        <title>{ariaLabel}</title>
        <polyline
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth={2}
          points={pointList}
        />
        {lastPoint ? (
          <circle cx={lastPoint.x} cy={lastPoint.y} r={2.5} fill="currentColor" />
        ) : null}
      </svg>
      <figcaption className="sr-only">
        {plotted.map((point) => `${point.label}: ${point.value}`).join("; ")}
      </figcaption>
    </figure>
  );
}
