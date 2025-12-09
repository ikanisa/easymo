import Link from "next/link";

export const metadata = {
  title: "Offline Help · SACCO+",
  description: "Cached support guidance for working offline in SACCO+.",
};

export const dynamic = "force-static";

export default function OfflineHelpPage() {
  return (
    <main
      className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 bg-nyungwe px-6 py-12 text-neutral-0"
      aria-labelledby="offline-help-heading"
    >
      <div className="flex flex-col gap-2 text-left">
        <p className="text-[11px] uppercase tracking-[0.3em] text-neutral-2">Cached guidance</p>
        <h1 id="offline-help-heading" className="text-3xl font-semibold leading-tight">
          You can still review how to work while offline
        </h1>
        <p className="text-sm text-neutral-100">
          This help center copy is stored on your device. Follow these reminders to keep
          reconciliation moving until you reconnect.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left shadow-md">
          <h2 className="text-lg font-semibold">Capture changes for later</h2>
          <p className="text-sm text-neutral-100">
            Queue reconciliation updates and approvals. They will sync automatically once the
            network is back.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-100">
            <li>Keep references and ikimina IDs handy for quick entry.</li>
            <li>Note any conflicts so you can resolve them after sync completes.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left shadow-md">
          <h2 className="text-lg font-semibold">Confirm what is cached</h2>
          <p className="text-sm text-neutral-100">
            The reconciliation workspace, dashboards, and offline queue are cached. Reloading them
            will not use data until you reconnect.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-100">
            <li>Use the offline queue panel to review pending changes.</li>
            <li>Network banners will confirm when sync restarts.</li>
          </ul>
        </section>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left shadow-md">
        <h2 className="text-lg font-semibold">Need to contact support?</h2>
        <p className="text-sm text-neutral-100">
          Draft details now and send once online. Support can also reference your last-known data
          snapshot if you mention the time it was captured.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link
            href="mailto:support@ibimina.rw"
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 font-semibold text-neutral-0 transition hover:border-white/40 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-nyungwe"
          >
            Email support@ibimina.rw
          </Link>
          <Link
            href="tel:+250788123456"
            className="rounded-xl border border-white/10 px-4 py-2 font-semibold text-neutral-0 transition hover:border-white/25 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-nyungwe"
          >
            Call support
          </Link>
        </div>
      </div>
    </main>
  );
}
