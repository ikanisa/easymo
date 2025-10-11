import { render, screen, fireEvent, waitFor } from "./utils/react-testing";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { SettingsForm } from "@/components/settings/SettingsForm";
import type {
  PlatformSettingsData,
  SavePlatformSettingsResult,
} from "@/lib/settings/platform-settings-service";

const fetchPlatformSettings = vi.fn<[], Promise<PlatformSettingsData>>();
const savePlatformSettings = vi.fn<
  [PlatformSettingsData],
  Promise<SavePlatformSettingsResult>
>();
const pushToast = vi.fn();

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ pushToast }),
}));

vi.mock("@/lib/settings/platform-settings-service", () => ({
  fetchPlatformSettings: (...args: unknown[]) =>
    fetchPlatformSettings(...args),
  savePlatformSettings: (...args: unknown[]) =>
    savePlatformSettings(...args),
}));

describe("SettingsForm", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchPlatformSettings.mockReset();
    savePlatformSettings.mockReset();
    pushToast.mockReset();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("loads settings on mount", async () => {
    fetchPlatformSettings.mockResolvedValue({
      quietHours: { start: "08:00", end: "18:00" },
      throttlePerMinute: 120,
      optOutList: ["+2507"],
      integration: { status: "ok", target: "settings_store" },
    });
    savePlatformSettings.mockResolvedValue({
      ok: true,
      message: "Saved",
    });

    render(<SettingsForm />);

    await waitFor(() => expect(fetchPlatformSettings).toHaveBeenCalled());
    expect(
      screen.getByDisplayValue("08:00 – 18:00"),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("120")).toBeInTheDocument();
    expect(screen.getByText("Policy storage")).toBeInTheDocument();
  });

  it("falls back to defaults when load fails", async () => {
    fetchPlatformSettings.mockRejectedValue(new Error("network"));

    render(<SettingsForm />);

    await waitFor(() =>
      expect(pushToast).toHaveBeenCalledWith(
        "Unable to load settings; showing defaults.",
        "error",
      )
    );
    expect(screen.getByDisplayValue("22:00 – 06:00")).toBeInTheDocument();
  });

  it("validates quiet hours before saving", async () => {
    fetchPlatformSettings.mockResolvedValue({
      quietHours: { start: "08:00", end: "18:00" },
      throttlePerMinute: 120,
      optOutList: [],
    });
    savePlatformSettings.mockResolvedValue({
      ok: true,
      message: "Saved",
    });

    render(<SettingsForm />);
    await waitFor(() => expect(fetchPlatformSettings).toHaveBeenCalled());

    fireEvent.change(screen.getByDisplayValue("08:00 – 18:00"), {
      target: { value: "invalid quiet hours" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /save settings/i }));

    expect(savePlatformSettings).not.toHaveBeenCalled();
    expect(pushToast).toHaveBeenCalledWith(
      "Quiet hours must use format HH:MM – HH:MM.",
      "error",
    );
  });

  it("saves settings and shows integration", async () => {
    fetchPlatformSettings.mockResolvedValue({
      quietHours: { start: "08:00", end: "18:00" },
      throttlePerMinute: 120,
      optOutList: ["+2507"],
    });
    savePlatformSettings.mockResolvedValue({
      ok: true,
      message: "Settings saved.",
      integration: { status: "ok", target: "settings_store" },
    });

    render(<SettingsForm />);
    await waitFor(() => expect(fetchPlatformSettings).toHaveBeenCalled());

    fireEvent.change(screen.getByDisplayValue("08:00 – 18:00"), {
      target: { value: "21:00 – 05:00" },
    });
    fireEvent.change(screen.getByDisplayValue("120"), {
      target: { value: "90" },
    });
    fireEvent.change(screen.getByPlaceholderText("+2507..."), {
      target: { value: "+250700000001, +250700000002" },
    });

    fireEvent.submit(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() =>
      expect(savePlatformSettings).toHaveBeenCalledWith({
        quietHours: { start: "21:00", end: "05:00" },
        throttlePerMinute: 90,
        optOutList: ["+250700000001", "+250700000002"],
      })
    );
    expect(pushToast).toHaveBeenCalledWith("Settings saved.", "success");
    expect(screen.getByText("Policy storage")).toBeInTheDocument();
  });

  it("shows error feedback when save fails", async () => {
    fetchPlatformSettings.mockResolvedValue({
      quietHours: { start: "08:00", end: "18:00" },
      throttlePerMinute: 120,
      optOutList: [],
    });
    savePlatformSettings.mockResolvedValue({
      ok: false,
      message: "Unable to persist settings.",
      integration: { status: "degraded", target: "settings_store" },
    });

    render(<SettingsForm />);
    await waitFor(() => expect(fetchPlatformSettings).toHaveBeenCalled());

    fireEvent.submit(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() =>
      expect(pushToast).toHaveBeenCalledWith(
        "Unable to persist settings.",
        "error",
      )
    );
    expect(screen.getByText("Unable to persist settings.")).toBeInTheDocument();
    expect(screen.getByText("Policy storage")).toBeInTheDocument();
  });
});
