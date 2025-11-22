"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { getAdminRoutePath } from "@/lib/routes";

export default function HomePage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace(getAdminRoutePath("panelDashboard"));
  }, [router]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
