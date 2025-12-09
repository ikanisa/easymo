"use client";
import Link from "next/link";
import { ArrowLeft, Compass, LifeBuoy } from "lucide-react";

const supportEmail = "support@ibimina.rw";
const quickLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/ikimina", label: "Ibimina" },
  { href: "/recon", label: "Reconciliation" },
  { href: "/reports", label: "Reports" },
];

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-nyungwe px-6 py-16 text-neutral-0">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
        <header className="glass flex flex-col gap-4 rounded-3xl p-10 text-center shadow-glass">
          <span className="mx-auto inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-neutral-2">
            404 • Page Not Found
          </span>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">Twarabuze iyo paji</h1>
          <p className="text-sm text-neutral-2 md:text-base">
            The link you followed is unavailable. Choose a destination below or head back to the
            dashboard. If you believe this is a mistake, contact SACCO support and quote the URL you
            tried to open.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/dashboard"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-kigali px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-ink shadow-glass transition hover:bg-kigali/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kigali/80 focus-visible:ring-offset-2 focus-visible:ring-offset-ink sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to dashboard
            </Link>
            <Link
              href={`mailto:${supportEmail}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white/10 px-6 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-neutral-0 shadow-glass transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-ink sm:w-auto"
            >
              <LifeBuoy className="h-4 w-4" aria-hidden="true" />
              Contact support
            </Link>
          </div>
        </header>

        <section
          className="glass space-y-6 rounded-3xl p-8 shadow-glass"
          aria-labelledby="quick-links-heading"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-neutral-0">
              <Compass className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h2 id="quick-links-heading" className="text-lg font-semibold text-neutral-0">
                Quick navigation
              </h2>
              <p className="text-xs text-neutral-2">
                Access frequently used work queues and dashboards.
              </p>
            </div>
          </div>
          <nav className="grid gap-3 sm:grid-cols-2" aria-label="Suggested destinations">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="interactive-scale flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 text-left text-neutral-0 shadow-inner transition hover:border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-ink focus-visible:ring-white/40"
              >
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-neutral-2">
                    {link.label}
                  </p>
                  <p className="text-xs text-neutral-3">Open module</p>
                </div>
                <Compass className="h-5 w-5 text-neutral-1" aria-hidden="true" />
              </Link>
            ))}
          </nav>
        </section>

        <footer className="rounded-3xl border border-white/10 bg-black/30 p-6 text-center text-xs text-neutral-3">
          Having trouble with access? Email{" "}
          <a
            className="font-semibold text-neutral-0 underline decoration-dotted underline-offset-2"
            href={`mailto:${supportEmail}`}
          >
            {supportEmail}
          </a>{" "}
          and include screenshots plus the route you expected.
        </footer>
      </div>
    </main>
  );
}
