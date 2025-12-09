import { useCallback, useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { useFocusTrap } from "@/src/lib/a11y/useFocusTrap";

describe("Quick actions focus trap", () => {
  function QuickActionsHarness() {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);

    const close = useCallback(() => {
      setOpen(false);
    }, []);

    useFocusTrap(open, containerRef, {
      onEscape: close,
      initialFocus: () =>
        containerRef.current?.querySelector<HTMLElement>("[data-focus-target]") ?? null,
      returnFocus: () => triggerRef.current?.focus(),
    });

    return (
      <div>
        <button type="button" ref={triggerRef} onClick={() => setOpen(true)}>
          Open quick actions
        </button>
        {open ? (
          <div role="presentation" className="backdrop">
            <div
              ref={containerRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label="Quick actions"
            >
              <a href="#first" data-focus-target>
                First link
              </a>
              <button type="button">Second action</button>
              <button type="button" onClick={close}>
                Close overlay
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  it("cycles focus within the overlay", async () => {
    const user = userEvent.setup();
    render(<QuickActionsHarness />);

    const trigger = screen.getByRole("button", { name: /open quick actions/i });
    trigger.focus();
    await user.click(trigger);

    const firstLink = await screen.findByRole("link", { name: /first link/i });
    await waitFor(() => expect(firstLink).toHaveFocus());

    const buttons = screen
      .getAllByRole("button")
      .filter((btn) => btn.textContent !== "Open quick actions");

    await user.tab();
    expect(buttons[0]).toHaveFocus();
    await user.tab();
    expect(buttons[1]).toHaveFocus();
    await user.tab();
    expect(firstLink).toHaveFocus();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<QuickActionsHarness />);

    const trigger = screen.getByRole("button", { name: /open quick actions/i });
    trigger.focus();
    await user.click(trigger);

    await screen.findByRole("link", { name: /first link/i });

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: /quick actions/i })).not.toBeInTheDocument()
    );
    expect(document.activeElement).toBe(trigger);
  });
});
