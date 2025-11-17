import { z } from "zod";
import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";
import {
  adminAlertPreferenceSchema,
  type AdminAlertPreference,
} from "@/lib/schemas";

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

export async function listAdminAlertPreferences(): Promise<AdminAlertPreferencesResult> {
  try {
    const payload = await apiFetch<{
      data: unknown;
      integration?: unknown;
    }>(getAdminApiPath("settings", "alerts"));

    const parsed = z
      .object({
        data: z.array(adminAlertPreferenceSchema),
        integration: alertIntegrationSchema.optional(),
      })
      .safeParse(payload);

    if (parsed.success) {
      return parsed.data;
    }

    console.error(
      "Failed to parse alert preferences response",
      parsed.error.flatten(),
    );
  } catch (error) {
    console.error("Failed to fetch alert preferences", error);
  }

  return {
    data: [],
    integration: {
      status: "degraded",
      target: "admin_alert_prefs",
      message: "Unable to load alert preferences.",
    },
  };
}
