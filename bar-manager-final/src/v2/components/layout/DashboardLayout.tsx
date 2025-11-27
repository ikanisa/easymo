import type { ReactNode } from "react";

import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <a className="skip-link" href="#v2-main-content">
        Skip to main content
      </a>
      <div className="flex h-full">
        <div className="dashboard-shell">
          <div className="dashboard-shell__grid">
            <Sidebar />
            <div className="dashboard-shell__workspace">
              <Header />
              <main
                id="v2-main-content"
                tabIndex={-1}
                className="flex-1 p-6 dashboard-shell__content"
                role="main"
              >
                <div className="mx-auto max-w-7xl space-y-6">{children}</div>
              </main>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
