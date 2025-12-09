import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function InviteDeepLinkPage({ params }: { params: { token: string } }) {
  const supabase = createSupabaseAdminClient();
  const { data: invite, error } = await supabase
    .from("group_invites")
    .select("id, token, status, group_id, created_at, ibimina(name)")
    .eq("token", params.token)
    .maybeSingle();

  if (error || !invite) {
    notFound();
  }

  const schemeUrl = `ibimina://invite/${invite.token}`;

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-12 text-center">
      <h1 className="text-2xl font-semibold text-ink">Accept SACCO invite</h1>
      <p className="text-sm text-ink/70">
        Invitation for <strong>{invite.ibimina?.name ?? "an ibimina group"}</strong>. Use the button
        below to open the SACCO+ app and accept the invite.
      </p>
      <div className="space-y-3">
        <Link
          href={schemeUrl}
          className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400"
        >
          Open SACCO+ (ibimina://)
        </Link>
        <div className="rounded-2xl border border-ink/10 bg-ink/5 p-4 text-left">
          <p className="text-xs font-semibold text-ink/70">Invite token</p>
          <p className="mt-1 break-all font-mono text-xs text-ink/90">{invite.token}</p>
        </div>
      </div>
      <p className="text-xs text-ink/60">
        If the app does not open automatically, copy the link or enter the token manually inside
        SACCO+.
      </p>
    </div>
  );
}
