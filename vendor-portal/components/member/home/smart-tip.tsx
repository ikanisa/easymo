import { BellRing } from "lucide-react";

export function SmartTip() {
  return (
    <div className="flex items-center gap-4 rounded-3xl border border-white/15 bg-gradient-to-r from-blue-500/40 via-yellow-400/30 to-emerald-500/30 p-5 text-neutral-0 shadow-glass">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
        <BellRing className="h-8 w-8" aria-hidden />
      </div>
      <div>
        <p className="text-lg font-semibold">Smart tip</p>
        <p className="text-sm text-white/80">
          Set a monthly reminder to stay consistent with your contributions.
        </p>
      </div>
    </div>
  );
}
