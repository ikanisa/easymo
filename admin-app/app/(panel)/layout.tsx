import type { ReactNode } from "react";
import type { Metadata } from "next";
// import { redirect } from "next/navigation";
import { PanelShell } from "@/components/layout/PanelShell";
// import { readSessionFromCookies } from "@/lib/server/session";

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

// TODO: Re-enable authentication later
// Authentication is temporarily disabled - allow direct access
export default async function PanelLayout({ children }: PanelLayoutProps) {
  // const session = await readSessionFromCookies();
  // if (!session) {
  //   redirect("/login");
  // }

  const environmentLabel = process.env.NEXT_PUBLIC_ENVIRONMENT_LABEL ?? "Staging";
  const assistantEnabled = (process.env.NEXT_PUBLIC_ASSISTANT_ENABLED ?? "")
    .toLowerCase() === "true";

  // Mock session for development - no authentication required
  const mockSession = { actorId: "dev-admin", label: "Development Admin" };

  return (
    <PanelShell
      environmentLabel={environmentLabel}
      assistantEnabled={assistantEnabled}
      session={mockSession}
    >
      {children}
    </PanelShell>
  );
}
