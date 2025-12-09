import type { MemberSaccoRow } from "@/lib/member/data";
import { Landmark } from "lucide-react";

interface MySaccosProps {
  saccos: MemberSaccoRow[];
}

export function MySaccos({ saccos }: MySaccosProps) {
  if (saccos.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/20 bg-white/5 p-6 text-center text-white/70">
        You have not linked any SACCOs yet.
      </div>
    );
  }

  return (
    <ul className="grid gap-4">
      {saccos.map((sacco) => (
        <li
          key={sacco.id}
          className="rounded-3xl border border-white/15 bg-white/8 p-5 text-neutral-0 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/20 p-3">
              <Landmark className="h-6 w-6" aria-hidden />
            </div>
            <div className="text-left">
              <p className="text-lg font-semibold">{sacco.name}</p>
              <p className="text-sm text-white/70">
                {sacco.district} · {sacco.sector_code}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
