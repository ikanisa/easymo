import { clsx } from "clsx";
import {
  type FieldsetHTMLAttributes,
  forwardRef,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  useId,
} from "react";

export interface FieldProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  label?: string;
  labelFor?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  orientation?: "vertical" | "horizontal";
  description?: string;
  /**
   * The field content. Can be a ReactNode or a render function that receives
   * control props (id, required, aria-describedby, aria-invalid) to apply to the input.
   */
  children?: ReactNode | ((props: InputHTMLAttributes<HTMLInputElement>) => ReactNode);
}

export const FormField = forwardRef<HTMLDivElement, FieldProps>(function FormField(
  {
    className,
    label,
    labelFor,
    helperText,
    error,
    required,
    orientation = "vertical",
    description,
    children,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const controlId = labelFor ?? `field-${generatedId}`;
  const helperId = helperText ? `${controlId}-help` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const describedBy = [descriptionId, helperId, errorId].filter(Boolean).join(" ") || undefined;

  const controlProps: Partial<InputHTMLAttributes<HTMLInputElement>> = {
    id: controlId,
    required,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
  };

  return (
    <div
      ref={ref}
      data-orientation={orientation}
      className={clsx(
        "flex flex-col gap-2",
        orientation === "horizontal" && "sm:flex-row sm:items-start sm:gap-6",
        className,
      )}
      {...props}
    >
      {label ? (
        <label
          htmlFor={controlId}
          className={clsx(
            "text-sm font-medium text-[color:var(--ui-color-foreground)]",
            orientation === "horizontal" && "sm:min-w-[12rem]",
          )}
        >
          {label}
          {required ? <span className="ml-1 text-[color:var(--ui-color-danger)]">*</span> : null}
        </label>
      ) : null}
      <div className="flex flex-1 flex-col gap-2">
        {typeof children === "function"
          ? (children as (props: InputHTMLAttributes<HTMLInputElement>) => ReactNode)(controlProps)
          : children}
        {description ? (
          <p
            id={descriptionId}
            className="text-sm text-[color:var(--ui-color-muted)]"
          >
            {description}
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            id={errorId}
            className="text-sm text-[color:var(--ui-color-danger)]"
          >
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-sm text-[color:var(--ui-color-muted)]">
            {helperText}
          </p>
        ) : null}
      </div>
    </div>
  );
});

export interface FieldsetProps extends FieldsetHTMLAttributes<HTMLFieldSetElement> {
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
      className={clsx("flex flex-col gap-4 rounded-xl border border-[color:var(--ui-color-border)]/70 p-4", className)}
      {...props}
    >
      {legend ? (
        <legend className="text-base font-semibold text-[color:var(--ui-color-foreground)]">
          {legend}
        </legend>
      ) : null}
      {description ? (
        <p className="text-sm text-[color:var(--ui-color-muted)]">{description}</p>
      ) : null}
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
      className={clsx(
        "text-sm",
        tone === "default" && "text-[color:var(--ui-color-muted)]",
        tone === "danger" && "text-[color:var(--ui-color-danger)]",
        tone === "success" && "text-[color:var(--ui-color-success)]",
        className,
      )}
      {...props}
    />
  );
});
