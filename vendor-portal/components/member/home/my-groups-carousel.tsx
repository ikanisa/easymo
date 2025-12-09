import type { MemberGroupRow } from "@/lib/member/data";
import { IkiminaWidget } from "@/components/member/groups/ikimina-widget";

interface MyGroupsCarouselProps {
  groups: MemberGroupRow[];
}

export function MyGroupsCarousel({ groups }: MyGroupsCarouselProps) {
  if (groups.length === 0) {
    return (
      <div className="rounded-3xl border border-white/15 bg-white/8 p-6 text-center text-neutral-0">
        <p className="text-lg font-semibold">No groups yet</p>
        <p className="mt-2 text-sm text-white/70">
          Add a SACCO and explore ibimina groups to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {groups.map((group) => (
        <div key={group.id} className="min-w-[280px] flex-1">
          <IkiminaWidget group={group} />
        </div>
      ))}
    </div>
  );
}
