import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <a className="skip-link" href="#v2-main-content">
        Skip to main content
      </a>
      <div className="flex h-full">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <Header />
          <main
            id="v2-main-content"
            tabIndex={-1}
            className="flex-1 p-6"
            role="main"
          >
            <div className="mx-auto max-w-7xl space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
