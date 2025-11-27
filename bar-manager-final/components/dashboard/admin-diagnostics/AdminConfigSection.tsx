import type { AdminDiagnosticsHealth } from "@/lib/schemas";

type AdminConfigSectionProps = {
  health: AdminDiagnosticsHealth;
};

export function AdminConfigSection({ health }: AdminConfigSectionProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">Admin config</h3>
      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="text-xs uppercase text-muted-foreground">
            Admin numbers
          </dt>
          <dd>
            {health.config?.admin_numbers && health.config.admin_numbers.length
              ? health.config.admin_numbers.join(", ")
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-muted-foreground">
            Insurance admins
          </dt>
          <dd>
            {health.config?.insurance_admin_numbers &&
                health.config.insurance_admin_numbers.length
              ? health.config.insurance_admin_numbers.join(", ")
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-muted-foreground">
            PIN required
          </dt>
          <dd>{health.config?.admin_pin_required ? "Yes" : "No"}</dd>
        </div>
      </dl>
    </div>
  );
}
