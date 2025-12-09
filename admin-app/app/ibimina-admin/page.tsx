export default function AdminGovernanceIndex() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <article className="rounded-2xl border border-ink/10 bg-ink/5 p-6">
        <h2 className="text-lg font-semibold text-ink">Countries</h2>
        <p className="mt-2 text-sm text-ink/70">
          Maintain the list of operating countries and their regulatory status.
        </p>
        <a
          className="mt-4 inline-flex items-center text-sm font-semibold text-emerald-600"
          href="/admin/countries"
        >
          Manage countries →
        </a>
      </article>
      <article className="rounded-2xl border border-ink/10 bg-ink/5 p-6">
        <h2 className="text-lg font-semibold text-ink">Telco providers</h2>
        <p className="mt-2 text-sm text-ink/70">
          Configure mobile money providers, merchant codes, and reference formats.
        </p>
        <a
          className="mt-4 inline-flex items-center text-sm font-semibold text-emerald-600"
          href="/admin/telcos"
        >
          Configure telcos →
        </a>
      </article>
      <article className="rounded-2xl border border-ink/10 bg-ink/5 p-6">
        <h2 className="text-lg font-semibold text-ink">Partner configuration</h2>
        <p className="mt-2 text-sm text-ink/70">
          Set feature flags and merchant metadata for SACCO partners.
        </p>
        <a
          className="mt-4 inline-flex items-center text-sm font-semibold text-emerald-600"
          href="/admin/partners"
        >
          Partner settings →
        </a>
      </article>
      <article className="rounded-2xl border border-ink/10 bg-ink/5 p-6">
        <h2 className="text-lg font-semibold text-ink">Staff invites</h2>
        <p className="mt-2 text-sm text-ink/70">
          Send or revoke invitations for SACCO staff accounts.
        </p>
        <a
          className="mt-4 inline-flex items-center text-sm font-semibold text-emerald-600"
          href="/admin/invites"
        >
          Manage invites →
        </a>
      </article>
    </div>
  );
}
