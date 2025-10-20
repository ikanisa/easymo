import { fireEvent, render, screen, waitFor } from "./utils/react-testing";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { AdminDiagnosticsMatch } from "@/lib/schemas";
import { TripDiagnosticsSection } from "@/components/dashboard/admin-diagnostics/TripDiagnosticsSection";

const getAdminDiagnosticsMatch = vi.fn<
  Promise<AdminDiagnosticsMatch>,
  [string]
>();

vi.mock("@/lib/admin/diagnostics-service", () => ({
  getAdminDiagnosticsMatch: (...args: [string]) =>
    getAdminDiagnosticsMatch(...args),
}));

const baseMatch: AdminDiagnosticsMatch = {
  trip: {
    id: "trip-123",
    role: "driver",
    vehicleType: "car",
    status: "matched",
  },
  messages: [],
};

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

describe("TripDiagnosticsSection", () => {
  beforeEach(() => {
    getAdminDiagnosticsMatch.mockReset();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("shows validation when trip id is missing", () => {
    render(<TripDiagnosticsSection />);

    fireEvent.submit(screen.getByRole("button", { name: /check/i }));

    expect(
      screen.getByText("Enter a trip id"),
    ).toBeInTheDocument();
    expect(getAdminDiagnosticsMatch).not.toHaveBeenCalled();
  });

  it("renders trip details when lookup succeeds", async () => {
    getAdminDiagnosticsMatch.mockResolvedValue({
      ...baseMatch,
      messages: ["Sample notice"],
    });

    render(<TripDiagnosticsSection />);

    const input = screen.getAllByPlaceholderText(/trip id/i)[0];
    fireEvent.change(input, {
      target: { value: " trip-123 " },
    });
    fireEvent.submit(screen.getByRole("button", { name: /check/i }));

    await waitFor(() =>
      expect(getAdminDiagnosticsMatch).toHaveBeenCalledWith("trip-123")
    );

    expect(screen.getByText("Sample notice")).toBeInTheDocument();
    expect(screen.getByText("Trip ID")).toBeInTheDocument();
    expect(screen.getByText("trip-123")).toBeInTheDocument();
  });

  it("surfaces service errors", async () => {
    getAdminDiagnosticsMatch.mockRejectedValue(new Error("network"));

    render(<TripDiagnosticsSection />);

    const input = screen.getAllByPlaceholderText(/trip id/i)[0];
    fireEvent.change(input, {
      target: { value: "trip-404" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /check/i }));

    await waitFor(() => expect(getAdminDiagnosticsMatch).toHaveBeenCalled());
    expect(await screen.findByText(
      "Unable to fetch trip diagnostics. Try again later.",
    )).toBeInTheDocument();
  });
});
