import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function JoinDeepLinkPage({ params }: { params: { groupId: string } }) {
  const supabase = createSupabaseAdminClient();
  const { data: group, error } = await supabase
    .from("groups")
    .select("id, name, status, org_id")
    .eq("id", params.groupId)
    .maybeSingle();

  if (error || !group) {
    notFound();
  }

  const schemeUrl = `ibimina://join/${group.id}`;

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-12 text-center">
      <h1 className="text-2xl font-semibold text-ink">Open in SACCO+ app</h1>
      <p className="text-sm text-ink/70">
        Join request for <strong>{group.name}</strong>. If the SACCO+ app is installed, use the
        button below. Otherwise copy the link or continue via the web console.
      </p>
      <div className="space-y-3">
        <Link
          href={schemeUrl}
          className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400"
        >
          Open SACCO+ (ibimina://)
        </Link>
        <div className="rounded-2xl border border-ink/10 bg-ink/5 p-4 text-left">
          <p className="text-xs font-semibold text-ink/70">Deep link</p>
          <p className="mt-1 break-all font-mono text-xs text-ink/90">{schemeUrl}</p>
        </div>
      </div>
      <p className="text-xs text-ink/60">
        Having trouble? Share this page or enter the reference code in the SACCO+ app to join the
        group manually.
      </p>
    </div>
  );
}
