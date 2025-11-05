import type { DashboardKpi } from "@/lib/schemas";
import { KPIWidget } from "@easymo/ui";
import { isUiKitEnabled } from "@/lib/ui-kit";

interface KpiCardProps {
  kpi: DashboardKpi;
}

export function KpiCard({ kpi }: KpiCardProps) {
  if (isUiKitEnabled()) {
    return (
      <KPIWidget
        label={kpi.label}
        value={kpi.primaryValue}
        secondary={kpi.secondaryValue ?? undefined}
        trend={
          kpi.trend
            ? {
                direction: kpi.trend === "flat" ? "neutral" : kpi.trend,
                label:
                  kpi.trend === "up"
                    ? "Trending up"
                    : kpi.trend === "down"
                    ? "Trending down"
                    : "Holding steady",
                srOnly: kpi.helpText,
              }
            : undefined
        }
        data-testid="ui-kit-kpi"
      />
    );
  }

  return (
    <article className="kpi-card" aria-label={kpi.label}>
      <header>
        <h2>{kpi.label}</h2>
      </header>
      <p className="kpi-card__value">{kpi.primaryValue}</p>
      {kpi.secondaryValue
        ? <p className="kpi-card__secondary">{kpi.secondaryValue}</p>
        : null}
      {kpi.helpText ? <p className="kpi-card__help">{kpi.helpText}</p> : null}
      {kpi.trend
        ? (
          <span className={`kpi-card__trend kpi-card__trend--${kpi.trend}`}>
            {kpi.trend}
          </span>
        )
        : null}
    </article>
  );
}
