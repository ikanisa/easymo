import { render, screen, fireEvent } from "./utils/react-testing";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SettingsPreviewSection } from "@/components/settings/SettingsPreviewSection";
import { TemplatesSection } from "@/components/settings/TemplatesSection";
import { IntegrationsSection } from "@/components/settings/IntegrationsSection";
import type { SettingEntry, TemplateMeta } from "@/lib/schemas";

const previewEntries: SettingEntry[] = [
  {
    key: "quiet_hours.rw",
    description: "Quiet hours",
    updatedAt: "2025-01-01T00:00:00.000Z",
    valuePreview: "22:00 – 06:00",
  },
];

const templates: TemplateMeta[] = [
  {
    id: "template-1",
    name: "Welcome",
    purpose: "Greeting",
    locales: ["en"],
    status: "approved",
    variables: ["name"],
    lastUsedAt: "2025-01-01T00:00:00.000Z",
    errorRate: 0,
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

describe("Templates section", () => {
  it("renders loading state", () => {
    render(
      <TemplatesSection
        isLoading
        templates={[]}
        statusFilter=""
        hasMore={false}
        loadingMore={false}
        onStatusChange={vi.fn()}
        onLoadMore={vi.fn()}
      />,
    );
    expect(screen.getByText(/loading templates/i)).toBeInTheDocument();
  });

  it("renders table and forwards events", () => {
    const onStatusChange = vi.fn();
    const onLoadMore = vi.fn();
    render(
      <TemplatesSection
        isLoading={false}
        templates={templates}
        statusFilter="approved"
        hasMore
        loadingMore={false}
        onStatusChange={onStatusChange}
        onLoadMore={onLoadMore}
      />,
    );

    fireEvent.change(screen.getByLabelText(/status/i), {
      target: { value: "draft" },
    });
    expect(onStatusChange).toHaveBeenCalledWith("draft");

    fireEvent.click(screen.getByRole("button", { name: /load more/i }));
    expect(onLoadMore).toHaveBeenCalled();
  });

  it("renders empty state", () => {
    render(
      <TemplatesSection
        isLoading={false}
        templates={[]}
        statusFilter=""
        hasMore={false}
        loadingMore={false}
        onStatusChange={vi.fn()}
        onLoadMore={vi.fn()}
      />,
    );
    expect(screen.getByText(/templates unavailable/i)).toBeInTheDocument();
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
