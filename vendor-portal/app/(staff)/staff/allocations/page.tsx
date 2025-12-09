import { loadAllocationTriage } from "@/lib/staff/data";

const CURRENCY_FORMAT = new Intl.NumberFormat("en-RW", {
  style: "currency",
  currency: "RWF",
  maximumFractionDigits: 0,
});

export default async function AllocationTriagePage() {
  const queue = await loadAllocationTriage();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-neutral-0">Allocation triage</h2>
        <p className="text-sm text-neutral-200/70">
          Review unallocated payments and assign them to the correct member or ikimina.
        </p>
      </header>

      {queue.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-neutral-200/80">
          No unallocated payments at the moment. Great job!
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
          <table className="min-w-full divide-y divide-white/10 text-sm text-neutral-50">
            <thead>
              <tr className="bg-white/10">
                <th className="px-4 py-3 text-left font-semibold">Received</th>
                <th className="px-4 py-3 text-left font-semibold">SACCO</th>
                <th className="px-4 py-3 text-left font-semibold">Group</th>
                <th className="px-4 py-3 text-left font-semibold">Member</th>
                <th className="px-4 py-3 text-right font-semibold">Amount</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {queue.map((item) => (
                <tr key={item.id} className="hover:bg-white/5">
                  <td className="px-4 py-3 text-xs text-neutral-200/80">
                    {new Date(item.receivedAt).toLocaleString("en-GB")}
                  </td>
                  <td className="px-4 py-3">{item.saccoName ?? "—"}</td>
                  <td className="px-4 py-3">{item.decodedGroup ?? "Unmatched"}</td>
                  <td className="px-4 py-3">{item.decodedMember ?? "Unknown"}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {CURRENCY_FORMAT.format(item.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-semibold text-amber-100">
                      {item.matchStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-200/80">
                    {item.rawReference ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
