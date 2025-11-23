"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-black/50 p-4 backdrop-blur-sm md:inset-0">
      <div className="relative w-full max-w-md max-h-full">
        <div className={cn("relative rounded-lg bg-white shadow-lg", className)}>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2.5 top-3 ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg bg-transparent text-sm text-gray-400 hover:bg-gray-200 hover:text-gray-900"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close modal</span>
          </button>
          <div className="p-6 text-center">
            {title && (
              <h3 className="mb-2 text-xl font-semibold text-gray-900">
                {title}
              </h3>
            )}
            {description && (
              <p className="mb-5 text-sm text-gray-500">{description}</p>
            )}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
