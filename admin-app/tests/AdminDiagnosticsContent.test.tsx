import { render, screen, waitFor } from "./utils/react-testing";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AdminDiagnosticsContent } from "@/components/dashboard/admin-diagnostics/AdminDiagnosticsContent";
import type { AdminDiagnosticsSnapshot } from "@/lib/schemas";

const getAdminDiagnosticsMatch = vi.fn();

vi.mock("@/lib/admin/diagnostics-service", () => ({
  getAdminDiagnosticsMatch: (...args: [string]) => getAdminDiagnosticsMatch(...args),
}));

const snapshot: AdminDiagnosticsSnapshot = {
  health: {
    config: {
      admin_numbers: ["+250700000000"],
      insurance_admin_numbers: ["+250700000001"],
      admin_pin_required: true,
    },
    messages: ["Mock health message"],
  },
  logs: {
    logs: [
      {
        id: "log-1",
        endpoint: "wa-webhook",
        status_code: 500,
        received_at: "2025-01-01T00:00:00.000Z",
      },
    ],
    messages: ["Mock log message"],
  },
};

describe("AdminDiagnosticsContent", () => {
  beforeEach(() => {
    getAdminDiagnosticsMatch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders health and logs sections", () => {
    render(<AdminDiagnosticsContent snapshot={snapshot} />);
    expect(screen.getByText("Mock health message")).toBeInTheDocument();
    expect(screen.getByText("Admin numbers")).toBeInTheDocument();
    expect(screen.getByText("Mock log message")).toBeInTheDocument();
  });

  it("handles trip lookup", async () => {
    getAdminDiagnosticsMatch.mockResolvedValue({
      trip: {
        id: "trip-123",
        role: "driver",
        vehicleType: "car",
        status: "matched",
      },
      messages: [],
    });

    render(<AdminDiagnosticsContent snapshot={snapshot} />);

    const input = screen.getByPlaceholderText(/trip id/i);
    await userEvent.clear(input);
    await userEvent.type(input, "trip-123");
    await userEvent.click(screen.getByRole("button", { name: /check/i }));

    await waitFor(() =>
      expect(getAdminDiagnosticsMatch).toHaveBeenCalledWith("trip-123"),
    );
    expect(screen.getByText("Trip ID")).toBeInTheDocument();
  });
});
