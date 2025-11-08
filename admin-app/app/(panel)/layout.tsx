import { ReactNode } from "react";
// import { redirect } from "next/navigation";
import { PanelShell } from "@/components/layout/PanelShell";
// import { readSessionFromCookies } from "@/lib/server/session";

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
