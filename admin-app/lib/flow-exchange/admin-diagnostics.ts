import { z } from "zod";

import {
  type AdminDiagnosticsHealth,
  adminDiagnosticsHealthSchema,
  type AdminDiagnosticsLogs,
  adminDiagnosticsLogSchema,
  adminDiagnosticsLogsSchema,
  type AdminDiagnosticsMatch,
  adminDiagnosticsMatchSchema,
  type AdminDiagnosticsMatchSummary,
  adminDiagnosticsMatchSummarySchema,
  adminDiagnosticsMatchTripSchema,
  type AdminDiagnosticsQueues,
  adminDiagnosticsQueueSchema,
  type AdminDiagnosticsSnapshot,
  adminDiagnosticsSnapshotSchema,
} from "@/lib/schemas";

const messageSchema = z.object({
  type: z.enum(["info", "warning", "error"]),
  text: z.string(),
});

const baseResponseSchema = z.object({
  next_screen_id: z.string(),
  data: z.unknown().optional(),
  messages: z.array(messageSchema).optional(),
});

const healthDataSchema = z.object({
  config: z
    .object({
      admin_numbers: z.array(z.string()).nullable().optional(),
      insurance_admin_numbers: z.array(z.string()).nullable().optional(),
      admin_pin_required: z.boolean().nullable().optional(),
    })
    .nullable()
    .optional(),
});

const logsDataSchema = z.object({
  logs: z.array(adminDiagnosticsLogSchema).optional(),
});

const healthResponseSchema = baseResponseSchema.extend({
  data: healthDataSchema.optional(),
});

const logsResponseSchema = baseResponseSchema.extend({
  data: logsDataSchema.optional(),
});

const matchDataSchema = z.object({
  trip: z
    .object({
      id: z.string(),
      role: z.string().nullable().optional(),
      vehicle_type: z.string().nullable().optional(),
      status: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

const matchResponseSchema = baseResponseSchema.extend({
  data: matchDataSchema.optional(),
});

function mapMessages(messages?: Array<{ text: string }>): string[] {
  if (!messages) return [];
  return messages.map((message) => message.text);
}

export function parseAdminDiagnosticsHealth(
  payload: unknown,
): AdminDiagnosticsHealth {
  const parsed = healthResponseSchema.parse(payload);
  return adminDiagnosticsHealthSchema.parse({
    config: parsed.data?.config ?? null,
    messages: mapMessages(parsed.messages),
  });
}

export function parseAdminDiagnosticsLogs(
  payload: unknown,
): AdminDiagnosticsLogs {
  const parsed = logsResponseSchema.parse(payload);
  return adminDiagnosticsLogsSchema.parse({
    logs: parsed.data?.logs ?? [],
    messages: mapMessages(parsed.messages),
  });
}

export function parseAdminDiagnosticsMatch(
  payload: unknown,
): AdminDiagnosticsMatch {
  const parsed = matchResponseSchema.parse(payload);
  const trip = parsed.data?.trip
    ? adminDiagnosticsMatchTripSchema.parse({
      id: parsed.data.trip.id,
      role: parsed.data.trip.role ?? null,
      vehicleType: parsed.data.trip.vehicle_type ?? null,
      status: parsed.data.trip.status ?? null,
    })
    : null;
  return adminDiagnosticsMatchSchema.parse({
    trip,
    messages: mapMessages(parsed.messages),
  });
}

export function composeDiagnosticsSnapshot(
  health: AdminDiagnosticsHealth,
  logs: AdminDiagnosticsLogs,
  matches?: Partial<AdminDiagnosticsMatchSummary>,
  queues?: Partial<AdminDiagnosticsQueues>,
): AdminDiagnosticsSnapshot {
  return adminDiagnosticsSnapshotSchema.parse({
    health,
    logs,
    matches: adminDiagnosticsMatchSummarySchema.parse(matches ?? {}),
    queues: adminDiagnosticsQueueSchema.parse(queues ?? {}),
  });
}
