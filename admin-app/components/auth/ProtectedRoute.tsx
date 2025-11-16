"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "@/components/providers/SupabaseAuthProvider";

interface ProtectedRouteProps {
  children: ReactNode;
  redirectTo?: string;
  requireAdmin?: boolean;
  fallback?: ReactNode;
}

export function ProtectedRoute({
  children,
  redirectTo = "/login",
  requireAdmin = false,
  fallback,
}: ProtectedRouteProps) {
  const { status, isAdmin } = useSupabaseAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(redirectTo);
    }
    if (requireAdmin && status === "authenticated" && !isAdmin) {
      router.replace(redirectTo);
    }
  }, [isAdmin, redirectTo, requireAdmin, router, status]);

  if (status === "loading") {
    return (
      fallback ?? (
        <div className="panel-page__container">
          <p className="text-sm text-neutral-500">Checking your access…</p>
        </div>
      )
    );
  }

  if (status !== "authenticated") {
    return null;
  }

  if (requireAdmin && !isAdmin) {
    return null;
  }

  return <>{children}</>;
}
