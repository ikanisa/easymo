import { useCallback, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CommandPalette } from "@/components/common/command-palette";

describe("CommandPalette accessibility", () => {
  it("traps focus within the dialog", async () => {
    const user = userEvent.setup();
    render(<CommandPalette isOpen onClose={vi.fn()} />);

    const input = await screen.findByRole("textbox", { name: /search/i });
    await waitFor(() => expect(input).toHaveFocus());

    const options = screen.getAllByRole("option");

    await user.tab();
    expect(options[0]).toHaveFocus();

    for (let index = 1; index < options.length; index += 1) {
      await user.tab();
      expect(options[index]).toHaveFocus();
    }

    await user.tab();
    expect(input).toHaveFocus();
  });

  it("closes on Escape and restores focus to the trigger", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [open, setOpen] = useState(false);
      const handleClose = useCallback(() => {
        setOpen(false);
        onClosed();
      }, []);

      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open palette
          </button>
          {open ? <CommandPalette isOpen={open} onClose={handleClose} /> : null}
        </>
      );
    }

    const onClosed = vi.fn();
    render(<Harness />);

    const trigger = screen.getByRole("button", { name: /open palette/i });
    trigger.focus();
    await user.click(trigger);

    const input = await screen.findByRole("textbox", { name: /search/i });
    await waitFor(() => expect(input).toHaveFocus());

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /search and navigate/i })
      ).not.toBeInTheDocument();
    });

    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(trigger);
  });
});
