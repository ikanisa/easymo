import type { ButtonHTMLAttributes } from "react";
import { forwardRef } from "react";

export interface AccessibleActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ariaLabel: string;
  reduceMotion?: boolean;
}

function joinClasses(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(" ");
}

export const AccessibleActionButton = forwardRef<HTMLButtonElement, AccessibleActionButtonProps>(
  function AccessibleActionButton({ ariaLabel, className, reduceMotion, children, ...props }, ref) {
    return (
      <button
        {...props}
        ref={ref}
        aria-label={ariaLabel}
        className={joinClasses(
          "relative inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-lg px-4 py-3",
          "text-base font-medium text-white shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
          "focus-visible:outline-emerald-500",
          reduceMotion
            ? "transition-none"
            : "transition-transform duration-150 ease-out hover:scale-[1.01]",
          className
        )}
        style={{
          backgroundColor: "#14532d",
          letterSpacing: "0.01em",
        }}
      >
        <span className="pointer-events-none flex select-none items-center gap-2">{children}</span>
      </button>
    );
  }
);
