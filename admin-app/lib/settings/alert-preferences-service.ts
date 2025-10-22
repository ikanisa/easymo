import { z } from "zod";
import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import { shouldUseMocks } from "@/lib/runtime-config";
import {
  adminAlertPreferenceSchema,
  type AdminAlertPreference,
} from "@/lib/schemas";
import { mockAdminAlertPreferences } from "@/lib/mock-data";

export type AlertPreferencesIntegration = {
  status: "ok" | "degraded";
  target: string;
  message?: string;
};

export type AdminAlertPreferencesResult = {
  data: AdminAlertPreference[];
  integration?: AlertPreferencesIntegration;
};

const alertIntegrationSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  target: z.string(),
  message: z.string().optional(),
});

const useMocks = shouldUseMocks();

export async function listAdminAlertPreferences(): Promise<
  AdminAlertPreferencesResult
> {
  if (useMocks) {
    return {
      data: mockAdminAlertPreferences,
      integration: {
        status: "degraded",
        target: "admin_alert_prefs",
        message: "Using mock alert preferences.",
      },
    };
  }

  const response = await apiFetch<{
    data: unknown;
    integration?: unknown;
  }>(getAdminApiPath("settings", "alerts"));

  if (response.ok) {
    const parsed = z.object({
      data: z.array(adminAlertPreferenceSchema),
      integration: alertIntegrationSchema.optional(),
    }).safeParse(response.data);
    if (parsed.success) {
      return parsed.data;
    }
    console.error(
      "Failed to parse alert preferences response",
      parsed.error.flatten(),
    );
  } else {
    console.error("Failed to fetch alert preferences", response.error);
  }

  return {
    data: mockAdminAlertPreferences,
    integration: {
      status: "degraded",
      target: "admin_alert_prefs",
      message: "Falling back to mock alert preferences.",
    },
  };
}
