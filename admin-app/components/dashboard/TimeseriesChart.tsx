import type { TimeseriesPoint } from "@/lib/schemas";

interface TimeseriesChartProps {
  data: TimeseriesPoint[];
}

const WIDTH = 600;
const HEIGHT = 220;
const PADDING = 32;

function buildPolyline(points: number[][]): string {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

export function TimeseriesChart({ data }: TimeseriesChartProps) {
  if (!data.length) {
    return (
      <div className="placeholder-card">
        <strong>Time-series unavailable</strong>
        <p>No data points returned for this range.</p>
      </div>
    );
  }

  const issuedValues = data.map((point) => point.issued);
  const redeemedValues = data.map((point) => point.redeemed);
  const maxValue = Math.max(...issuedValues, ...redeemedValues, 1);

  const xStep = (WIDTH - PADDING * 2) / Math.max(data.length - 1, 1);

  const issuedPolyline = buildPolyline(
    data.map((point, index) => {
      const x = PADDING + index * xStep;
      const y = HEIGHT - PADDING -
        (point.issued / maxValue) * (HEIGHT - PADDING * 2);
      return [x, y];
    }),
  );

  const redeemedPolyline = buildPolyline(
    data.map((point, index) => {
      const x = PADDING + index * xStep;
      const y = HEIGHT - PADDING -
        (point.redeemed / maxValue) * (HEIGHT - PADDING * 2);
      return [x, y];
    }),
  );

  const yTicks = [0.25, 0.5, 0.75, 1].map((fraction) => (
    {
      value: Math.round(maxValue * fraction),
      y: HEIGHT - PADDING - fraction * (HEIGHT - PADDING * 2),
    }
  ));

  return (
    <figure
      className="timeseries-chart"
      aria-label="Issued versus redeemed vouchers"
    >
      <svg
        width="100%"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="issuedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(14, 165, 233, 0.4)" />
            <stop offset="100%" stopColor="rgba(14, 165, 233, 0.05)" />
          </linearGradient>
          <linearGradient id="redeemedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(34, 197, 94, 0.4)" />
            <stop offset="100%" stopColor="rgba(34, 197, 94, 0.05)" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={PADDING}
              x2={WIDTH - PADDING}
              y1={tick.y}
              y2={tick.y}
              stroke="rgba(148, 163, 184, 0.2)"
              strokeWidth={1}
            />
            <text
              x={PADDING - 8}
              y={tick.y + 4}
              textAnchor="end"
              fontSize={12}
              fill="rgba(71, 85, 105, 0.8)"
            >
              {tick.value}
            </text>
          </g>
        ))}

        <polyline
          points={issuedPolyline}
          fill="none"
          stroke="rgba(14, 165, 233, 0.9)"
          strokeWidth={2}
        />
        <polyline
          points={redeemedPolyline}
          fill="none"
          stroke="rgba(34, 197, 94, 0.9)"
          strokeWidth={2}
        />
      </svg>
      <figcaption>
        Issued (blue) vs Redeemed (green) vouchers for the selected range. Max
        value {maxValue}.
      </figcaption>
    </figure>
  );
}
