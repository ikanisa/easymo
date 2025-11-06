export const dynamic = 'force-dynamic';
import { headers } from "next/headers";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { logStructured } from "@/lib/server/logger";
import { recordAudit } from "@/lib/server/audit";
import { mockAdminAlertPreferences } from "@/lib/mock-data";
import { jsonOk, jsonError, zodValidationError } from "@/lib/api/http";
import type { AdminAlertPreference } from "@/lib/schemas";
import {
  ALERT_DEFINITIONS,
  DEFAULT_ALERT_CHANNELS,
  definitionForAlert,
} from "@/lib/settings/alert-definitions";
import { requireActorId, UnauthorizedError } from "@/lib/server/auth";
import { createHandler } from "@/app/api/withObservability";

const supabaseRowSchema = z.object({
  alert_key: z.string().nullable(),
  enabled: z.boolean().nullable(),
  channels: z.array(z.string()).nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

const updatePayloadSchema = z.object({
  updates: z.array(
    z.object({
      key: z.string(),
      enabled: z.boolean(),
      channels: z.array(z.string()).max(5).optional(),
    }),
  ).min(1),
});

type IntegrationStatus = {
  status: "ok" | "degraded";
  target: string;
  message?: string;
};

function mergePreferences(
  rows: z.infer<typeof supabaseRowSchema>[],
): AdminAlertPreference[] {
  const rowMap = new Map<
    string,
    { enabled: boolean; channels?: string[]; updatedAt?: string | null }
  >();

  for (const row of rows) {
    if (!row.alert_key) continue;
    rowMap.set(row.alert_key, {
      enabled: row.enabled ?? true,
      channels: row.channels ?? undefined,
      updatedAt: row.updated_at ?? null,
    });
  }

  return ALERT_DEFINITIONS.map((definition) => {
    const match = rowMap.get(definition.key);
    return {
      key: definition.key,
      label: definition.label,
      description: definition.description,
      severity: definition.severity,
      enabled: match?.enabled ?? true,
      channels: match?.channels && match.channels.length
        ? match.channels
        : definition.defaultChannels,
      updatedAt: match?.updatedAt ?? null,
      availableChannels: DEFAULT_ALERT_CHANNELS,
    };
  });
}

async function fetchPreferences(): Promise<{
  data: AdminAlertPreference[];
  integration?: IntegrationStatus;
}> {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return {
      data: mockAdminAlertPreferences,
      integration: {
        status: "degraded",
        target: "admin_alert_prefs",
        message:
          "Supabase credentials missing; returning mock alert preferences.",
      },
    };
  }

  const { data, error } = await adminClient
    .from("admin_alert_prefs")
    .select("alert_key, enabled, channels, updated_at")
    .eq("admin_user_id", null);

  if (error || !data) {
    logStructured({
      event: "alert_prefs_fetch_failed",
      target: "admin_alert_prefs",
      status: "degraded",
      message: "Failed to load admin alert preferences from Supabase.",
      details: { error: error?.message },
    });
    return {
      data: mergePreferences([]),
      integration: {
        status: "degraded",
        target: "admin_alert_prefs",
        message: "Falling back to default alert preferences.",
      },
    };
  }

  const parsed = z.array(supabaseRowSchema).safeParse(data);
  if (!parsed.success) {
    logStructured({
      event: "alert_prefs_parse_failed",
      target: "admin_alert_prefs",
      status: "degraded",
      message: "Supabase returned unexpected alert preference shape.",
      details: parsed.error.flatten(),
    });
    return {
      data: mergePreferences([]),
      integration: {
        status: "degraded",
        target: "admin_alert_prefs",
        message: "Falling back to default alert preferences.",
      },
    };
  }

  return {
    data: mergePreferences(parsed.data),
    integration: {
      status: "ok",
      target: "admin_alert_prefs",
    },
  };
}

export const GET = createHandler(
  "admin_api.settings.alerts.get",
  async () => {
    const result = await fetchPreferences();
    return jsonOk(result);
  },
);

export const POST = createHandler(
  "admin_api.settings.alerts.post",
  async (request: Request) => {
    const adminClient = getSupabaseAdminClient();
    if (!adminClient) {
      return jsonError({
        error: "supabase_unavailable",
        message:
          "Supabase credentials missing. Unable to persist alert preferences.",
      }, 503);
    }

    let payload: z.infer<typeof updatePayloadSchema>;
    try {
      payload = updatePayloadSchema.parse(await request.json());
    } catch (error) {
      return zodValidationError(error);
    }

    // Enforce admin actor for write
    try {
      requireActorId();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return jsonError({ error: "unauthorized", message: err.message }, 401);
      }
      throw err;
    }

    const invalidKey = payload.updates.find((update) =>
      !definitionForAlert(update.key)
    );
    if (invalidKey) {
      return jsonError({
        error: "unknown_alert_key",
        message: `Alert key ${invalidKey.key} is not recognised.`,
      }, 400);
    }

    const rows = payload.updates.map((update) => ({
      admin_user_id: null,
      alert_key: update.key,
      enabled: update.enabled,
      channels: update.channels ?? definitionForAlert(update.key)?.defaultChannels
        ?? [],
      updated_at: new Date().toISOString(),
    }));

    const { error } = await adminClient
      .from("admin_alert_prefs")
      .upsert(rows, { onConflict: "admin_user_id,alert_key" });

    if (error) {
      logStructured({
        event: "alert_prefs_update_failed",
        target: "admin_alert_prefs",
        status: "error",
        message: "Failed to save admin alert preferences to Supabase.",
        details: { error: error.message },
      });
      return jsonError({
        error: "alert_preferences_update_failed",
        message: "Unable to save alert preferences. Try again later.",
      }, 500);
    }

    const actorId = requireActorId();
    await recordAudit({
      actorId,
      action: "alert_preferences_update",
      targetTable: "admin_alert_prefs",
      targetId: "global",
      diff: {
        updates: payload.updates,
      },
    });

    const result = await fetchPreferences();

    logStructured({
      event: "alert_prefs_updated",
      target: "admin_alert_prefs",
      status: "ok",
      details: { count: payload.updates.length },
    });

    return jsonOk({ message: "Alert preferences saved.", ...result });
  },
);

export const runtime = "edge";
