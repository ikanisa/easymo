import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";

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

export async function fetchPlatformSettings(): Promise<PlatformSettingsResponse> {
  try {
    return await apiFetch<PlatformSettingsResponse>(getAdminApiPath("settings"), {
      cache: "no-store",
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Failed to load platform settings.";
    throw new Error(message);
  }
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
  try {
    const successBody = await apiFetch<{
      message?: string;
      integration?: PlatformSettingsIntegration;
    }>(getAdminApiPath("settings"), {
      method: "POST",
      body: payload,
    });

    return {
      ok: true,
      message: successBody?.message ?? "Settings saved.",
      integration: successBody?.integration,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Failed to save settings.";
    return {
      ok: false,
      message,
    };
  }
}
