interface LottieSlotProps {
  label: string;
}

export function LottieSlot({ label }: LottieSlotProps) {
  return (
    <div className="flex h-32 w-full items-center justify-center rounded-3xl border border-dashed border-white/20 bg-white/5 text-xs uppercase tracking-[0.3em] text-neutral-2">
      {label} animation coming soon
    </div>
  );
}
