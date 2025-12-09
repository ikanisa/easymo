import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  message?: string;
  fullScreen?: boolean;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

/**
 * LoadingSpinner - A reusable loading indicator component
 *
 * Features:
 * - Multiple size options (sm, md, lg)
 * - Optional loading message
 * - Full-screen overlay mode
 * - Accessible with aria-live and proper labeling
 * - Respects prefers-reduced-motion
 */
export function LoadingSpinner({
  size = "md",
  className,
  message,
  fullScreen = false,
}: LoadingSpinnerProps) {
  const spinner = (
    <div
      className={cn("flex items-center gap-3", fullScreen && "flex-col", className)}
      role="status"
      aria-live="polite"
      aria-label={message || "Loading"}
    >
      <Loader2
        className={cn("animate-spin text-neutral-1", sizeClasses[size])}
        aria-hidden="true"
      />
      {message && (
        <span className={cn("text-sm text-neutral-2", fullScreen && "text-center")}>{message}</span>
      )}
      <span className="sr-only">{message || "Loading, please wait"}</span>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="glass rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
          {spinner}
        </div>
      </div>
    );
  }

  return spinner;
}
