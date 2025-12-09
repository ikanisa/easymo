import { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requireUserAndProfile } from "@/lib/auth";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const auth = await requireUserAndProfile();
  if (auth.profile.role !== "SYSTEM_ADMIN") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-surface text-ink">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
        <header className="flex flex-col gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-ink/60">Governance</p>
            <h1 className="text-3xl font-semibold text-ink">Platform configuration</h1>
            <p className="text-sm text-ink/70">Manage multi-country rollout and staff access.</p>
          </div>
          <AdminNav />
        </header>
        <main className="rounded-3xl border border-ink/10 bg-white p-6 shadow-sm">{children}</main>
      </div>
    </div>
  );
}
