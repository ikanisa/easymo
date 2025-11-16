import { ReactNode } from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PanelShell } from "@/components/layout/PanelShell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: vi.fn(() => "/dashboard"),
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  ToastProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/system/OfflineBanner", () => ({
  OfflineBanner: () => null,
}));

vi.mock("@/components/system/ServiceWorkerToast", () => ({
  ServiceWorkerToast: () => null,
}));

vi.mock("@/components/system/ServiceWorkerToasts", () => ({
  ServiceWorkerToasts: () => null,
}));

vi.mock("@/components/assistant/AssistantPanel", () => ({
  AssistantPanel: () => null,
}));

describe("PanelShell mobile navigation accessibility", () => {
  afterEach(() => {
    cleanup();
  });

  const renderPanelShell = () =>
    render(
      <PanelShell
        assistantEnabled={false}
        environmentLabel="Test"
        actorId="actor-123"
        actorLabel="Test User"
      >
        <div>Content</div>
      </PanelShell>,
    );

  it("moves focus to the first navigation link when the drawer opens", async () => {
    const user = userEvent.setup();
    renderPanelShell();

    const menuButton = screen.getByRole("button", { name: /open navigation/i });
    await user.click(menuButton);

    const dialog = await screen.findByRole("dialog", {
      name: /primary navigation/i,
    });
    const firstLink = within(dialog).getByRole("link", { name: "Dashboard" });

    await waitFor(() => expect(firstLink).toHaveFocus());
  });

  it("closes the drawer on Escape and restores focus to the menu toggle", async () => {
    const user = userEvent.setup();
    renderPanelShell();

    const menuButton = screen.getByRole("button", { name: /open navigation/i });
    await user.click(menuButton);

    await screen.findByRole("dialog", { name: /primary navigation/i });

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: /primary navigation/i }),
      ).not.toBeInTheDocument(),
    );

    expect(menuButton).toHaveFocus();
  });

  it("closes the drawer when the backdrop is clicked and restores focus", async () => {
    const user = userEvent.setup();
    renderPanelShell();

    const menuButton = screen.getByRole("button", { name: /open navigation/i });
    await user.click(menuButton);

    await screen.findByRole("dialog", { name: /primary navigation/i });

    const backdrop = document.querySelector(
      ".bing-nav-drawer",
    ) as HTMLElement;
    await user.click(backdrop);

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: /primary navigation/i }),
      ).not.toBeInTheDocument(),
    );

    expect(menuButton).toHaveFocus();
  });

  it("traps focus within the drawer when tabbing", async () => {
    const user = userEvent.setup();
    renderPanelShell();

    const menuButton = screen.getByRole("button", { name: /open navigation/i });
    await user.click(menuButton);

    const dialog = await screen.findByRole("dialog", {
      name: /primary navigation/i,
    });

    const firstLink = within(dialog).getByRole("link", { name: "Dashboard" });

    const closeButton = within(dialog).getByRole("button", {
      name: /close navigation/i,
    });

    await user.tab({ shift: true });
    await waitFor(() => expect(closeButton).toHaveFocus());

    await user.tab();
    await waitFor(() => expect(firstLink).toHaveFocus());

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: /primary navigation/i }),
      ).not.toBeInTheDocument(),
    );

    expect(menuButton).toHaveFocus();
  });
});

