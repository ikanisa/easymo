import { redirect } from "next/navigation";
import { requireUserAndProfile } from "@/lib/auth";
import { supabaseSrv } from "@/lib/supabase/server";
import { isMissingRelationError } from "@/lib/supabase/errors";
import { isSystemAdmin } from "@/lib/permissions";
import { StaffDirectory } from "@/components/admin/staff/staff-directory";
import { InviteUserForm } from "@/components/admin/invite-user-form";

export const metadata = {
  title: "Staff Management",
};

export default async function AdminStaffPage() {
  const auth = await requireUserAndProfile();
  if (!isSystemAdmin(auth.profile)) {
    redirect("/admin");
  }

  const supabase = supabaseSrv();

  const [usersResult, saccosResult] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, role, sacco_id, created_at, suspended, saccos: saccos(name)")
      .order("created_at", { ascending: false }),
    supabase.schema("app").from("saccos").select("id, name").order("name", { ascending: true }),
  ]);

  if (usersResult.error && !isMissingRelationError(usersResult.error)) throw usersResult.error;
  if (saccosResult.error) throw saccosResult.error;

  const users = ((usersResult.data ?? []) as any[]).map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    sacco_id: u.sacco_id,
    sacco_name: (u as any).saccos?.name ?? null,
    created_at: u.created_at,
    suspended: (u as any).suspended ?? false,
  }));

  const saccos = (saccosResult.data ?? []).map((s) => ({
    id: s.id as string,
    name: s.name ?? "Unnamed SACCO",
  }));

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-0">Staff Directory</h1>
        <p className="text-neutral-2">Search, filter, and manage staff across SACCOs.</p>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <StaffDirectory initialUsers={users as any} saccos={saccos} />
        </div>
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h2 className="mb-3 text-lg font-semibold text-neutral-0">Add/Invite Staff</h2>
            <InviteUserForm />
          </div>
        </div>
      </section>
    </div>
  );
}
