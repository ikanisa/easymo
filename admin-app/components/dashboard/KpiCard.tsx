import type { DashboardKpi } from "@/lib/schemas";
import { KpiWidget } from "@easymo/ui/widgets/KpiWidget";
import { isUiKitEnabled } from "@/lib/ui-kit";

interface KpiCardProps {
  kpi: DashboardKpi;
}

export function KpiCard({ kpi }: KpiCardProps) {
  if (isUiKitEnabled()) {
    const trend = kpi.trend ?? undefined;

    return (
      <KpiWidget
        label={kpi.label}
        value={kpi.primaryValue}
        changeLabel={kpi.secondaryValue ?? undefined}
        trend={trend}
        context={kpi.helpText}
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
