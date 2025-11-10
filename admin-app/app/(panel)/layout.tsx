import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { PanelShell } from "@/components/layout/PanelShell";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { readSessionFromCookies } from "@/lib/server/session";

interface PanelLayoutProps {
  children: ReactNode;
}

export default async function PanelLayout({ children }: PanelLayoutProps) {
  const session = await readSessionFromCookies();
  if (!session) {
    redirect("/login");
  }

  const environmentLabel = process.env.NEXT_PUBLIC_ENVIRONMENT_LABEL ?? "Staging";
  const assistantEnabled = (process.env.NEXT_PUBLIC_ASSISTANT_ENABLED ?? "")
    .toLowerCase() === "true";

  return (
    <SessionProvider initialSession={session}>
      <PanelShell environmentLabel={environmentLabel} assistantEnabled={assistantEnabled}>
        {children}
      </PanelShell>
    </SessionProvider>
  );
}
