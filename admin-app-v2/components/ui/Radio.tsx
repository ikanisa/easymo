import * as React from "react";
import { cn } from "@/lib/utils";

export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className, label, error, ...props }, ref) => {
    const id = React.useId();
    const inputId = props.id || id;

    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <input
            type="radio"
            ref={ref}
            id={inputId}
            className={cn(
              "h-4 w-4 border-gray-300 text-primary-600 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-red-500",
              className
            )}
            {...props}
          />
          {label && (
            <label
              htmlFor={inputId}
              className="text-sm font-medium text-gray-900 cursor-pointer select-none"
            >
              {label}
            </label>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }
);

Radio.displayName = "Radio";
