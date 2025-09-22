import type { DashboardKpi } from '@/lib/schemas';

interface KpiCardProps {
  kpi: DashboardKpi;
}

export function KpiCard({ kpi }: KpiCardProps) {
  return (
    <article className="kpi-card" aria-label={kpi.label}>
      <header>
        <h2>{kpi.label}</h2>
      </header>
      <p className="kpi-card__value">{kpi.primaryValue}</p>
      {kpi.secondaryValue ? <p className="kpi-card__secondary">{kpi.secondaryValue}</p> : null}
      {kpi.helpText ? <p className="kpi-card__help">{kpi.helpText}</p> : null}
      {kpi.trend ? <span className={`kpi-card__trend kpi-card__trend--${kpi.trend}`}>{kpi.trend}</span> : null}
    </article>
  );
}
