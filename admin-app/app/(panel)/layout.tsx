import type { ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
  // TODO: Re-enable authentication later
  // For now, bypass session check and use mock session
  // const session = await readSessionFromCookies();
  // if (!session) {
  //   redirect("/login");
  // }
  
  // Mock session for development
  const session = {
    actorId: "dev-admin",
    label: "Development Admin",
  };

  const environmentLabel = process.env.NEXT_PUBLIC_ENVIRONMENT_LABEL ?? "Staging";
  const assistantEnabled = (process.env.NEXT_PUBLIC_ASSISTANT_ENABLED ?? "")
    .toLowerCase() === "true";

  return (
    <PanelShell
      environmentLabel={environmentLabel}
      assistantEnabled={assistantEnabled}
      session={session}
    >
      {children}
    </PanelShell>
  );
}
