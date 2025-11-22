import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { PanelShell } from "@/components/layout/PanelShell";
import { readSessionFromCookies } from "@/lib/server/session";

export const metadata: Metadata = {
  title: {
    default: "Insurance Agent Admin",
    template: "%s · Insurance Agent Admin",
  },
  description:
    "Operational console for the Insurance Agent workflow and supporting admin utilities.",
};

interface PanelLayoutProps {
  children: ReactNode;
}

export default async function PanelLayout({ children }: PanelLayoutProps) {
  const session = await readSessionFromCookies();
  if (!session) {
    redirect('/login');
  }
  const environmentLabel = process.env.NEXT_PUBLIC_ENVIRONMENT_LABEL ?? "Staging";
  const assistantEnabled = (process.env.NEXT_PUBLIC_ASSISTANT_ENABLED ?? "")
    .toLowerCase() === "true";
  const actorId = process.env.NEXT_PUBLIC_ADMIN_ACTOR_ID;
  const actorLabel = process.env.NEXT_PUBLIC_ADMIN_ACTOR_LABEL;

  return (
    <PanelShell
      environmentLabel={environmentLabel}
      assistantEnabled={assistantEnabled}
      actorId={actorId}
      actorLabel={actorLabel}
    >
      {children}
    </PanelShell>
  );
}
