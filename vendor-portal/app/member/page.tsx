import { getMemberHomeData } from "@/lib/member/data";
import { MyGroupsCarousel } from "@/components/member/home/my-groups-carousel";
import { SmartTip } from "@/components/member/home/smart-tip";
import { RecentActivity } from "@/components/member/home/recent-activity";

export default async function MemberHomePage() {
  const { groups, joinRequests, saccos } = await getMemberHomeData();

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <header className="flex items-center justify-between text-neutral-0">
          <div>
            <h1 className="text-3xl font-semibold">My groups</h1>
            <p className="text-sm text-white/80">
              {groups.length > 0
                ? "Stay on top of your ibimina contributions."
                : "Add a SACCO to discover ibimina groups."}
            </p>
          </div>
        </header>
        <MyGroupsCarousel groups={groups} />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Recent activity</h2>
          <p className="text-sm text-white/70">Linked SACCOs: {saccos.length}</p>
        </div>
        <RecentActivity joinRequests={joinRequests} />
      </section>

      <SmartTip />
    </div>
  );
}
