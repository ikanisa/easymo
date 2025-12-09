import type { ReactNode } from "react";
import { BottomNav } from "@/components/member/navigation/bottom-nav";
import { requireMemberSession } from "@/lib/member/session";

export default async function MemberLayout({ children }: { children: ReactNode }) {
  await requireMemberSession();

  return (
    <div className="min-h-screen bg-[var(--gradient-brand-hero)] pb-24 pt-6 text-[color:var(--color-foreground-inverse,#f8fafc)] transition-colors duration-300 bg-kigali text-neutral-0">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pb-16">{children}</main>
      <BottomNav />
    </div>
  );
}
