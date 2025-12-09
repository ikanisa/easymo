"use client";

import { useState } from "react";
import type { MemberGroupRow } from "@/lib/member/data";
import { UssdInstructions } from "@/components/member/pay/ussd-instructions";

interface PayComposerProps {
  groups: MemberGroupRow[];
}

export function PayComposer({ groups }: PayComposerProps) {
  const [selected, setSelected] = useState<string | null>(groups[0]?.id ?? null);

  return (
    <div className="space-y-4">
      <label className="space-y-2 text-neutral-0">
        <span className="text-sm font-semibold text-white/80">Group</span>
        <select
          className="w-full rounded-2xl border border-white/20 bg-black/40 px-4 py-3 text-base text-neutral-0 focus:border-emerald-400 focus:outline-none"
          value={selected ?? ""}
          onChange={(event) => setSelected(event.target.value || null)}
        >
          {groups.map((group) => (
            <option key={group.id} value={group.id} className="bg-black text-neutral-0">
              {group.name}
            </option>
          ))}
          {groups.length === 0 ? <option value="">No groups found</option> : null}
        </select>
      </label>
      <UssdInstructions groupId={selected} />
    </div>
  );
}
