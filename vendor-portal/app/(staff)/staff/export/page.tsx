import { requestAllocationExport } from "@/lib/staff/data";

export default function AllocationExportPage() {
  const triggerExport = async (formData: FormData) => {
    "use server";

    const saccoId = (formData.get("saccoId") as string | null) || null;
    const referenceToken = (formData.get("referenceToken") as string | null) || null;
    const period = (formData.get("period") as string | null) || null;

    await requestAllocationExport({ saccoId, referenceToken, period });
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-neutral-0">Export allocations</h2>
        <p className="text-sm text-neutral-200/70">
          Generate a secure export of reconciled allocations for auditors or SACCO partners.
        </p>
      </header>

      <form
        action={triggerExport}
        className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-neutral-100">SACCO ID (optional)</span>
            <input
              name="saccoId"
              className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-neutral-0 placeholder:text-neutral-400 focus:border-emerald-400 focus:outline-none"
              placeholder="Filter to a specific SACCO"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-neutral-100">Reference token (optional)</span>
            <input
              name="referenceToken"
              className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-neutral-0 placeholder:text-neutral-400 focus:border-emerald-400 focus:outline-none"
              placeholder="e.g. RWA.NYA.GAS.GROUP.MBR"
            />
          </label>
        </div>

        <label className="space-y-2">
          <span className="text-sm font-medium text-neutral-100">Period label (optional)</span>
          <input
            name="period"
            className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-neutral-0 placeholder:text-neutral-400 focus:border-emerald-400 focus:outline-none"
            placeholder="e.g. 2025-Q1"
          />
        </label>

        <p className="text-xs text-neutral-200/70">
          Exports run asynchronously via the <code>export-allocation</code> Edge function. You'll
          receive a notification once the file is ready.
        </p>

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-neutral-900 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:ring-offset-2 focus:ring-offset-nyungwe"
          >
            Start export
          </button>
        </div>
      </form>
    </div>
  );
}
