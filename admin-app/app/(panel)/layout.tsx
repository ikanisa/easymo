import { ReactNode } from 'react';
import { SidebarNav } from '@/components/layout/SidebarNav';
import { TopBar } from '@/components/layout/TopBar';
import { ToastProvider } from '@/components/ui/ToastProvider';

export default function PanelLayout({ children }: { children: ReactNode }) {
  const environmentLabel = process.env.NEXT_PUBLIC_ENVIRONMENT_LABEL ?? 'Staging';

  return (
    <ToastProvider>
      <div className="layout">
        <SidebarNav />
        <div className="layout__main">
          <TopBar environmentLabel={environmentLabel} />
          <main id="main-content" className="layout__content" aria-live="polite">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
