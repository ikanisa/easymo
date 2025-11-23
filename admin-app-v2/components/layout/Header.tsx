// Header component – top bar with optional actions
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";

export function Header({ toggleSidebar }: { toggleSidebar: () => void }) {
  const pathname = usePathname();
  return (
    <header className="flex h-16 items-center gap-4 border-b bg-white px-4 lg:hidden">
      <button
        type="button"
        onClick={toggleSidebar}
        className="-m-2.5 p-2.5 text-gray-700"
        aria-label="Open sidebar"
      >
        <Menu className="h-6 w-6" aria-hidden="true" />
      </button>
      <h1 className="text-lg font-semibold text-gray-900">
        {pathname.split("/")[1] || "Dashboard"}
      </h1>
    </header>
  );
}
