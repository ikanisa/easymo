import { loadReconExceptions } from "@/lib/staff/data";

export default async function ReconExceptionsPage() {
  const exceptions = await loadReconExceptions();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-neutral-0">Exceptions workflow</h2>
        <p className="text-sm text-neutral-200/70">
          Investigate reconciliation exceptions that require manual follow-up.
        </p>
      </header>

      {exceptions.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-neutral-200/80">
          No open exceptions. Keep monitoring the reconciliation queue.
        </div>
      ) : (
        <div className="space-y-4">
          {exceptions.map((item) => (
            <article
              key={item.id}
              className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-inner"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-neutral-0">{item.reason}</p>
                  <p className="text-xs text-neutral-200/70">Exception ID: {item.id}</p>
                  <p className="text-xs text-neutral-200/70">Payment ID: {item.paymentId}</p>
                </div>
                <span className="inline-flex items-center rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-100">
                  {item.status}
                </span>
              </div>
              <div className="mt-4 text-xs text-neutral-200/80">
                Created {new Date(item.createdAt).toLocaleString("en-GB")}
              </div>
              {item.note ? <p className="mt-3 text-sm text-neutral-100/90">{item.note}</p> : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
