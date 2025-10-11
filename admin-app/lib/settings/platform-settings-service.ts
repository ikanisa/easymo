import { apiFetch } from "@/lib/api/client";

export type PlatformSettingsIntegration = {
  status: "ok" | "degraded";
  target: string;
  message?: string;
  reason?: string;
};

export type PlatformSettingsData = {
  quietHours: {
    start: string;
    end: string;
  };
  throttlePerMinute: number;
  optOutList: string[];
  integration?: PlatformSettingsIntegration;
};

type PlatformSettingsResponse = PlatformSettingsData;

type PlatformSettingsSaveSuccess = {
  message?: string;
  integration?: PlatformSettingsIntegration;
};

type PlatformSettingsSaveError = {
  error?: string;
  message?: string;
  integration?: PlatformSettingsIntegration;
};

export async function fetchPlatformSettings(): Promise<PlatformSettingsResponse> {
  const response = await apiFetch<PlatformSettingsResponse>("/api/settings", {
    cache: "no-store",
  });

  if (!response.ok) {
    const message = (response.error as { message?: string })?.message ??
      "Failed to load platform settings.";
    throw new Error(message);
  }

  return response.data;
}

export type SavePlatformSettingsResult =
  | {
    ok: true;
    message: string;
    integration?: PlatformSettingsIntegration;
  }
  | {
    ok: false;
    message: string;
    integration?: PlatformSettingsIntegration;
  };

export async function savePlatformSettings(
  payload: PlatformSettingsData,
): Promise<SavePlatformSettingsResult> {
  const response = await apiFetch<PlatformSettingsSaveSuccess>(
    "/api/settings",
    {
      method: "POST",
      body: payload,
    },
  );

  if (!response.ok) {
    const errorBody = response.error as PlatformSettingsSaveError;
    const message = typeof errorBody?.message === "string"
      ? errorBody.message
      : typeof errorBody?.error === "string"
      ? errorBody.error
      : "Failed to save settings.";
    return {
      ok: false,
      message,
      integration: errorBody?.integration,
    };
  }

  const successBody = response.data;
  return {
    ok: true,
    message: successBody?.message ?? "Settings saved.",
    integration: successBody?.integration,
  };
}
