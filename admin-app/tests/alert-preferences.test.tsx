import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "./utils/react-testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { AlertPreferences } from "@/components/settings/AlertPreferences";
import { getAdminApiPath } from "@/lib/routes";

const pushToast = vi.fn();
const useAdminAlertPreferencesQuery = vi.fn();

vi.mock("@/lib/queries/alertPreferences", () => ({
  useAdminAlertPreferencesQuery: (...args: unknown[]) =>
    useAdminAlertPreferencesQuery(...args),
}));

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ pushToast }),
}));

const integrationStatus = { status: "ok", target: "admin_alert_prefs" };

beforeEach(() => {
  pushToast.mockReset();
  useAdminAlertPreferencesQuery.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AlertPreferences", () => {
  it("submits updates when toggling preference state", async () => {
    const preference = {
      key: "INS_OCR_FAIL",
      label: "Insurance OCR failures",
      description: "Raised when OCR uploads fail.",
      severity: "critical",
      channels: ["email"],
      enabled: true,
      updatedAt: "2025-01-01T00:00:00.000Z",
      availableChannels: ["email", "whatsapp"],
    };

    useAdminAlertPreferencesQuery.mockReturnValue({
      data: { data: [preference], integration: integrationStatus },
      isLoading: false,
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [preference],
          integration: integrationStatus,
          message: "Alert preference saved.",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AlertPreferences />);

    expect(screen.getByText("Insurance OCR failures")).toBeTruthy();

    const toggle = screen.getByLabelText("Toggle Insurance OCR failures");
    fireEvent.click(toggle);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      getAdminApiPath("settings", "alerts"),
    );
    expect(pushToast).toHaveBeenCalledWith("Alert preference saved.", "success");

    const request = fetchMock.mock.calls[0]?.[1];
    const payload = request?.body
      ? JSON.parse(request.body as string)
      : { updates: [] };

    expect(payload.updates[0]).toMatchObject({
      key: "INS_OCR_FAIL",
      enabled: false,
    });
  });

  it("shows validation when enabling with no channels selected", async () => {
    const preference = {
      key: "NOTIFY_CRON_DISABLED",
      label: "Notification cron disabled",
      description: "Raised when the notification worker cron stops running.",
      severity: "medium",
      channels: [],
      enabled: false,
      updatedAt: null,
      availableChannels: ["email"],
    };

    useAdminAlertPreferencesQuery.mockReturnValue({
      data: { data: [preference], integration: integrationStatus },
      isLoading: false,
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<AlertPreferences />);

    fireEvent.click(screen.getByLabelText("Toggle Notification cron disabled"));

    await waitFor(() => {
      expect(
        screen.getByText("Select at least one channel or disable the alert."),
      ).toBeTruthy();
    });
    expect(pushToast).toHaveBeenCalledWith(
      "Select at least one channel or disable the alert.",
      "error",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
