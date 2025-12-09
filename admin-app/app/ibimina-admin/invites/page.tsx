import Link from "next/link";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const inviteStaff = async (formData: FormData) => {
  "use server";

  const email = (formData.get("email") as string | null)?.trim();
  const saccoId = (formData.get("saccoId") as string | null)?.trim();
  const role = (formData.get("role") as string | null)?.trim() || "SACCO_STAFF";

  if (!email || !saccoId) {
    throw new Error("Email and SACCO are required");
  }

  const supabase = createSupabaseAdminClient();
  await supabase.functions.invoke("invite-user", {
    body: {
      email,
      saccoId,
      role,
    },
  });

  revalidatePath("/admin/invites");
};

export default async function StaffInvitesPage() {
  const supabase = createSupabaseAdminClient();
  const { data: invites } = await supabase
    .from("group_invites")
    .select("id, token, status, invitee_msisdn, created_at, group_id, ibimina(name)")
    .order("created_at", { ascending: false })
    .limit(25);

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold text-ink">Staff invites</h2>
        <p className="text-sm text-ink/70">
          Send invitations to SACCO staff. Invites expire after 7 days if not accepted.
        </p>
      </header>

      <form
        action={inviteStaff}
        className="grid gap-4 rounded-2xl border border-ink/10 bg-ink/5 p-6 sm:grid-cols-2"
      >
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Staff email</span>
          <input
            type="email"
            name="email"
            required
            className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
            placeholder="staff@example.com"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">SACCO ID</span>
          <input
            name="saccoId"
            required
            className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
            placeholder="UUID of SACCO"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Role</span>
          <select
            name="role"
            className="w-full rounded-2xl border border-ink/20 bg-white px-4 py-3 text-sm text-ink focus:border-emerald-400 focus:outline-none"
          >
            <option value="SACCO_STAFF">SACCO staff</option>
            <option value="SACCO_MANAGER">SACCO manager</option>
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400"
          >
            Send invite
          </button>
        </div>
      </form>

      <p className="text-xs text-ink/60">
        Invites are delivered via email. Staff can accept using the deep link at
        <code className="ml-1 rounded bg-ink/10 px-1">/invite/&lt;token&gt;</code>.
      </p>

      <div className="overflow-hidden rounded-2xl border border-ink/10">
        <table className="min-w-full divide-y divide-ink/10 text-sm">
          <thead className="bg-ink/5">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-ink">Group</th>
              <th className="px-4 py-3 text-left font-semibold text-ink">Invitee</th>
              <th className="px-4 py-3 text-left font-semibold text-ink">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-ink">Created</th>
              <th className="px-4 py-3 text-right font-semibold text-ink">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {(invites ?? []).map((invite) => (
              <tr key={invite.id}>
                <td className="px-4 py-3 text-ink/90">{invite.ibimina?.name ?? invite.group_id}</td>
                <td className="px-4 py-3 text-ink/70">{invite.invitee_msisdn ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    {invite.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink/70">
                  {invite.created_at ? new Date(invite.created_at).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/invite/${invite.token}`}
                    className="text-sm font-semibold text-emerald-600"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {!invites?.length && (
              <tr>
                <td className="px-4 py-6 text-center text-sm text-ink/60" colSpan={5}>
                  No invites issued yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
