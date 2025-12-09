import { getMemberHomeData } from "@/lib/member/data";
import { GroupGrid } from "@/components/member/groups/group-grid";

export default async function MemberGroupsPage() {
  const { groups, joinRequests } = await getMemberHomeData();

  return (
    <div className="space-y-6 text-neutral-0">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Groups</h1>
        <p className="text-sm text-white/70">
          Explore ibimina across your SACCOs and request to join the groups that matter to you.
        </p>
      </header>
      <GroupGrid groups={groups} joinRequests={joinRequests} />
    </div>
  );
}
