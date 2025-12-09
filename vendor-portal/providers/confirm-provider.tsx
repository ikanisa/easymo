"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRef } from "react";

import { Modal } from "@/components/ui/modal";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    open: boolean;
    options: ConfirmOptions;
    resolve?: (value: boolean) => void;
  }>({ open: false, options: { title: "" } });

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, options, resolve });
    });
  }, []);

  const close = (result: boolean) => {
    state.resolve?.(result);
    setState((prev) => ({ ...prev, open: false }));
  };

  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Modal
        open={state.open}
        onClose={() => close(false)}
        title={state.options.title}
        description={state.options.description}
        size="sm"
        initialFocusRef={cancelRef}
        footer={
          <>
            <button
              type="button"
              ref={cancelRef}
              onClick={() => close(false)}
              className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-neutral-2 transition hover:border-white/40 hover:text-neutral-0"
            >
              {state.options.cancelLabel ?? "Cancel"}
            </button>
            <button
              type="button"
              onClick={() => close(true)}
              className="rounded-full bg-kigali px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-ink shadow-glass transition hover:bg-[#ffe066]"
            >
              {state.options.confirmLabel ?? "Confirm"}
            </button>
          </>
        }
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirmDialog() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error("useConfirmDialog must be used within ConfirmProvider");
  return context.confirm;
}
