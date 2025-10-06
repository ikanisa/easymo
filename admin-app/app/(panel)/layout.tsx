import { ReactNode, useState } from "react";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { TopBar } from "@/components/layout/TopBar";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { GradientBackground } from "@/components/layout/GradientBackground";
import { OfflineBanner } from "@/components/system/OfflineBanner";
import { ServiceWorkerToast } from "@/components/system/ServiceWorkerToast";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";

export default function PanelLayout({ children }: { children: ReactNode }) {
  const environmentLabel = process.env.NEXT_PUBLIC_ENVIRONMENT_LABEL ??
    "Staging";
  const [assistantOpen, setAssistantOpen] = useState(false);

  return (
    <ToastProvider>
      <ServiceWorkerToast />
      <OfflineBanner />
      <GradientBackground variant="surface" className="min-h-screen">
        <div className="layout">
          <SidebarNav />
          <div className="layout__main">
            <TopBar
              environmentLabel={environmentLabel}
              onOpenAssistant={() => setAssistantOpen(true)}
            />
            <main
              id="main-content"
              className="layout__content"
              aria-live="polite"
            >
              {children}
            </main>
          </div>
        </div>
        <AssistantPanel open={assistantOpen} onClose={() => setAssistantOpen(false)} />
      </GradientBackground>
    </ToastProvider>
  );
}
