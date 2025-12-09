import { CachedSnapshots } from "./cached-snapshots";

export const metadata = {
  title: "Offline snapshots · SACCO+",
  description: "Review last-known cached data while offline.",
};

export const dynamic = "force-static";

export default function OfflineSnapshotsPage() {
  return (
    <main
      className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 bg-nyungwe px-6 py-12 text-neutral-0"
      aria-labelledby="offline-snapshots-heading"
    >
      <div className="flex flex-col gap-2 text-left">
        <p className="text-[11px] uppercase tracking-[0.3em] text-neutral-2">Cached data</p>
        <h1 id="offline-snapshots-heading" className="text-3xl font-semibold leading-tight">
          Last-known snapshots
        </h1>
        <p className="text-sm text-neutral-100">
          These responses were saved from your last online session. Use them to continue
          reconciliation reviews or to brief support.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left shadow-md">
        <CachedSnapshots />
      </div>
    </main>
  );
}
