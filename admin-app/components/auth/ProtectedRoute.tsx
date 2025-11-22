"use client";

import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

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
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      setIsRedirecting(true);
      router.replace(redirectTo);
    }
    if (requireAdmin && status === "authenticated" && !isAdmin) {
      setIsRedirecting(true);
      router.replace(redirectTo);
    }
  }, [isAdmin, redirectTo, requireAdmin, router, status]);

  if (status === "loading" || isRedirecting) {
    return (
      fallback ?? (
        <div className="panel-page__container">
          <p className="text-sm text-neutral-500">
            {isRedirecting ? "Redirecting…" : "Checking your access…"}
          </p>
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
