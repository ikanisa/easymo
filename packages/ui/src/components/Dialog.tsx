"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ElementRef, HTMLAttributes } from "react";
import { clsx } from "clsx";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

export const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function DialogOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={clsx(
        "fixed inset-0 z-50 bg-[color:var(--ui-color-overlay)]/70 backdrop-blur-[var(--ui-glass-frost-blur)] transition-opacity duration-200",
        "data-[state=open]:opacity-100 data-[state=closed]:opacity-0",
        className,
      )}
      {...props}
    />
  );
});

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(function DialogContent({ className, children, ...props }, ref) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={clsx(
          "fixed inset-0 z-50 flex items-center justify-center px-4 py-6",
          className,
        )}
        {...props}
      >
        <div
          className="w-full max-w-lg rounded-3xl border border-[color:var(--ui-color-border)]/40 bg-[color:var(--ui-color-surface-elevated)]/95 p-6 text-[color:var(--ui-color-foreground)] shadow-[var(--ui-glass-shadow)]"
        >
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});

export const DialogHeader = function DialogHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("flex flex-col gap-2 text-center sm:text-left", className)} {...props} />
  );
};

export const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={clsx("text-xl font-semibold text-[color:var(--ui-color-foreground)]", className)}
      {...props}
    />
  );
});

export const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={clsx("text-sm text-[color:var(--ui-color-muted)]", className)}
      {...props}
    />
  );
});

export const DialogFooter = function DialogFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
};
