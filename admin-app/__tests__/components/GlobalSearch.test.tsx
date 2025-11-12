import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "../../tests/utils/react-testing";
import { GlobalSearch } from "@/components/search/GlobalSearch";

const originalFetch = global.fetch;

function mockFetch() {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      query: "",
      results: [],
      suggestions: [],
    }),
  }) as unknown as typeof fetch;
}

describe("GlobalSearch", () => {
  beforeEach(() => {
    global.fetch = mockFetch();
  });

  afterEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      delete (global as typeof global & { fetch?: typeof fetch }).fetch;
    }
  });

  it("opens and focuses when meta+K shortcut is used", async () => {
    render(<GlobalSearch />);

    const combobox = screen.getByRole("combobox", { name: /search admin workspace/i });

    expect(combobox).toHaveAttribute("aria-expanded", "false");

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    await waitFor(() => {
      expect(combobox).toHaveAttribute("aria-expanded", "true");
      expect(combobox).toHaveFocus();
    });
  });

  it("closes the panel when the shortcut is used again", async () => {
    render(<GlobalSearch />);
    const combobox = screen.getByRole("combobox", { name: /search admin workspace/i });

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    await waitFor(() => expect(combobox).toHaveAttribute("aria-expanded", "true"));

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    await waitFor(() => expect(combobox).toHaveAttribute("aria-expanded", "false"));
  });

  it("ignores the shortcut when pressed inside other editable elements", async () => {
    render(
      <div>
        <input data-testid="external-input" />
        <GlobalSearch />
      </div>,
    );

    const combobox = screen.getByRole("combobox", { name: /search admin workspace/i });
    const externalInput = screen.getByTestId("external-input");

    fireEvent.focus(externalInput);
    fireEvent.keyDown(externalInput, { key: "k", ctrlKey: true });

    await waitFor(() => {
      expect(combobox).toHaveAttribute("aria-expanded", "false");
      expect(combobox).not.toHaveFocus();
    });
  });
});
