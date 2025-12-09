import { getMemberHomeData } from "@/lib/member/data";
import { getMemberSession } from "@/lib/member/session";
import { ProfileOverview } from "@/components/member/profile/profile-overview";

export default async function MemberProfilePage() {
  const session = await getMemberSession();
  const { profile, saccos, groups, joinRequests, loans } = await getMemberHomeData();

  return (
    <div className="space-y-6 text-neutral-0">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Profile</h1>
        <p className="text-sm text-white/70">
          Manage your contact info, documents, and notification preferences.
        </p>
      </header>
      <ProfileOverview
        profile={profile}
        email={session?.email ?? null}
        saccos={saccos}
        groups={groups}
        joinRequests={joinRequests}
        loans={loans}
      />
    </div>
  );
}
