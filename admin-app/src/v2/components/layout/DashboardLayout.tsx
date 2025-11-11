import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dashboard-shell">
      <div className="dashboard-shell__grid">
        <Sidebar />
        <div className="dashboard-shell__workspace">
          <Header />
          <main className="dashboard-shell__content" id="v2-main-content">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
