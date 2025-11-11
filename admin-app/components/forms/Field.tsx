import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: "vertical" | "horizontal";
  label?: string;
  labelFor?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
}

export const Field = forwardRef<HTMLDivElement, FieldProps>(function Field(
  { className, orientation = "vertical", label, labelFor, helperText, error, required, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-orientation={orientation}
      className={cn(
        "flex flex-col gap-2",
        orientation === "horizontal" && "sm:flex-row sm:items-start sm:gap-6",
        className,
      )}
      {...props}
    >
      {label ? (
        <label
          htmlFor={labelFor}
          className={cn(
            "text-label text-[color:var(--color-foreground)]",
            orientation === "horizontal" && "sm:min-w-[12rem]",
          )}
        >
          {label}
          {required ? <span className="ml-1 text-caption text-[color:var(--color-danger)]">*</span> : null}
        </label>
      ) : null}
      <div className="flex flex-1 flex-col gap-2">
        {children}
        {error ? (
          <p role="alert" className="text-helper text-[color:var(--color-danger)]">
            {error}
          </p>
        ) : helperText ? (
          <p className="text-helper">{helperText}</p>
        ) : null}
      </div>
    </div>
  );
});

export interface FieldsetProps extends HTMLAttributes<HTMLFieldSetElement> {
  legend?: string;
  description?: string;
}

export const Fieldset = forwardRef<HTMLFieldSetElement, FieldsetProps>(function Fieldset(
  { className, legend, description, children, ...props },
  ref,
) {
  return (
    <fieldset
      ref={ref}
      className={cn("flex flex-col gap-4", className)}
      {...props}
    >
      {legend ? <legend className="text-heading-sm">{legend}</legend> : null}
      {description ? <p className="text-body-sm text-muted">{description}</p> : null}
      {children}
    </fieldset>
  );
});

export interface HelperTextProps extends HTMLAttributes<HTMLParagraphElement> {
  tone?: "default" | "danger" | "success";
}

export const HelperText = forwardRef<HTMLParagraphElement, HelperTextProps>(function HelperText(
  { className, tone = "default", ...props },
  ref,
) {
  return (
    <p
      ref={ref}
      className={cn(
        "text-helper",
        tone === "danger" && "text-[color:var(--color-danger)]",
        tone === "success" && "text-[color:var(--color-success)]",
        className,
      )}
      {...props}
    />
  );
});
