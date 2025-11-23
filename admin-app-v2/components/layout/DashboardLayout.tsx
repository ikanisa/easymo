"use client";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileSidebar } from "./MobileSidebar";
import { Menu } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileSidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <Sidebar />

      <div className="lg:pl-72">
        <Header toggleSidebar={() => setSidebarOpen(true)} />

        <main className="py-10">
          <div className="px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
