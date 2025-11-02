"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ElementRef, ReactNode, CSSProperties } from "react";
import { clsx } from "clsx";
const srOnlyStyles: CSSProperties = {
  border: 0,
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: "1px",
  margin: "-1px",
  overflow: "hidden",
  padding: 0,
  position: "absolute",
  width: "1px",
  whiteSpace: "nowrap",
};

export const DialogRoot = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const Dialog = DialogPrimitive.Root;

export const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={clsx(
      "fixed inset-0 z-50 bg-[color:rgba(15,23,42,0.55)] backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export interface DialogContentProps
  extends ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /**
   * Accessible label for assistive technologies when the dialog heading is visually hidden.
   */
  "aria-label"?: string;
  /**
   * Optional visually-hidden title. Provide when no visible heading is rendered.
   */
  srOnlyTitle?: string;
  /**
   * Optional description text read by screen readers.
   */
  description?: ReactNode;
}

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, srOnlyTitle, description, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={clsx(
        "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[color:rgba(var(--easymo-colors-neutral-400),0.3)] bg-[color:rgba(var(--easymo-colors-neutral-50),0.95)] p-6 shadow-[0_28px_80px_rgba(15,23,42,0.35)] focus:outline-none",
        "data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95",
        className,
      )}
      {...props}
    >
      {srOnlyTitle ? (
        <span style={srOnlyStyles} data-slot="sr-only">
          {srOnlyTitle}
        </span>
      ) : null}
      {description ? (
        <p className="text-sm text-[color:rgba(var(--easymo-colors-neutral-600))]">
          {description}
        </p>
      ) : null}
      {children}
      <DialogPrimitive.Close
        className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-[color:rgb(var(--easymo-colors-neutral-500))] transition hover:border-[color:rgba(var(--easymo-colors-neutral-400),0.5)] hover:text-[color:rgb(var(--easymo-colors-neutral-900))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--easymo-colors-primary-400)]"
        aria-label="Close dialog"
      >
        <span aria-hidden="true">×</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
export const DialogClose = DialogPrimitive.Close;
