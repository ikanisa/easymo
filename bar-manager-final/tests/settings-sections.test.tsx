import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { IntegrationsSection } from "@/components/settings/IntegrationsSection";
import { SettingsPreviewSection } from "@/components/settings/SettingsPreviewSection";
import type { SettingEntry } from "@/lib/schemas";

import { render, screen } from "./utils/react-testing";

const previewEntries: SettingEntry[] = [
  {
    key: "quiet_hours.rw",
    description: "Quiet hours",
    updatedAt: "2025-01-01T00:00:00.000Z",
    valuePreview: "22:00 – 06:00",
  },
];

describe("Settings preview section", () => {
  it("renders loading state", () => {
    render(<SettingsPreviewSection isLoading data={[]} />);
    expect(screen.getByText(/loading settings/i)).toBeInTheDocument();
  });

  it("renders table when data present", () => {
    render(<SettingsPreviewSection isLoading={false} data={previewEntries} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    render(<SettingsPreviewSection isLoading={false} data={[]} />);
    expect(
      screen.getByText(/settings preview unavailable/i),
    ).toBeInTheDocument();
  });
});

describe("Integrations section", () => {
  it("renders integrations status", () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <IntegrationsSection />
      </QueryClientProvider>,
    );
    expect(
      screen.getByText(/integrations status/i),
    ).toBeInTheDocument();
  });
});
