import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { AtlasPageConfig } from "./page-config";

const statusAccentMap: Record<
  NonNullable<AtlasPageConfig["roadmap"][number]["status"]>,
  string
> = {
  live: "bg-emerald-50 text-emerald-700 border-emerald-200",
  beta: "bg-amber-50 text-amber-700 border-amber-200",
  next: "bg-slate-50 text-slate-600 border-slate-200",
};

export function AtlasBlueprintPage({ config }: { config: AtlasPageConfig }) {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-100/70 bg-white/80 p-6 shadow-[0_25px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/70">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <div className="text-4xl">{config.hero.icon}</div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-500">
                {config.hero.badge}
              </p>
              <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
                {config.hero.title}
              </h1>
              <p className="text-base text-slate-600 dark:text-slate-300">
                {config.hero.description}
              </p>
            </div>
          </div>
          {config.hero.actions?.length ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              {config.hero.actions.map((action) => (
                action.href ? (
                  <Button
                    key={action.label}
                    asChild
                    variant={action.variant === "ghost" ? "ghost" : "default"}
                    size="lg"
                  >
                    <Link href={action.href}>{action.label}</Link>
                  </Button>
                ) : (
                  <Button
                    key={action.label}
                    variant={action.variant === "ghost" ? "ghost" : "default"}
                    size="lg"
                  >
                    {action.label}
                  </Button>
                )
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {config.metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-2xl border border-slate-100 bg-white/70 px-4 py-5 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900/50"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {metric.label}
              </p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
                {metric.value}
              </p>
              {metric.helper && (
                <p className="mt-1 text-xs text-slate-500">{metric.helper}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {config.highlights.map((highlight) => (
          <div
            key={highlight.title}
            className="rounded-2xl border border-slate-100/70 bg-white/70 p-5 shadow-[0_15px_50px_-35px_rgba(15,23,42,0.6)] backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/70"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {highlight.pill}
            </p>
            <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
              {highlight.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {highlight.description}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-100/70 bg-white/80 p-6 shadow-[0_25px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/70">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Roadmap
            </p>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Built like ChatGPT Atlas
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Focused delivery lanes with weekly releases and signal-driven prioritisation.
            </p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {config.roadmap.map((item) => (
            <div
              key={item.label}
              className={`rounded-2xl border px-4 py-5 ${statusAccentMap[item.status]} bg-white`}
            >
              <Badge variant={item.status === "live" ? "green" : item.status === "beta" ? "yellow" : "slate"}>
                {item.status === "live" ? "Shipping" : item.status === "beta" ? "In beta" : "Up next"}
              </Badge>
              <h3 className="mt-3 text-lg font-semibold">{item.label}</h3>
              <p className="mt-2 text-sm leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {config.quickLinks?.length ? (
        <section className="rounded-3xl border border-slate-100/80 bg-gradient-to-br from-slate-50 via-white to-slate-100/40 p-6 shadow-[0_30px_70px_-45px_rgba(15,23,42,0.5)] dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Linked workspaces
            </p>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
              Keep building the loop
            </h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {config.quickLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="group rounded-2xl border border-slate-100/70 bg-white/70 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white dark:border-slate-800/70 dark:bg-slate-900/80"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">
                  {link.pill}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {link.label}
                  </h3>
                  <span className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-500">
                    →
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {link.description}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
