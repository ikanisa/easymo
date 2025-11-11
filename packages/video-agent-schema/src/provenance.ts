import { Type } from "@sinclair/typebox";
import { z } from "zod";

import { uuidSchema, uuidType } from "./common.js";
import {
  jobAssetReferenceSchema,
  jobAssetReferenceType,
} from "./jobs.js";

const metadataRecord = () => z.record(z.string(), z.unknown()).default({});

export const provenanceActorSchema = z.object({
  type: z.enum(["system", "user", "integration"]),
  id: z.string().optional(),
  displayName: z.string().optional(),
  email: z.string().email().optional(),
  metadata: metadataRecord(),
});

export const provenanceActorType = Type.Object({
  type: Type.Union([
    Type.Literal("system"),
    Type.Literal("user"),
    Type.Literal("integration"),
  ]),
  id: Type.Optional(Type.String()),
  displayName: Type.Optional(Type.String()),
  email: Type.Optional(Type.String({ format: "email" })),
  metadata: Type.Record(Type.String(), Type.Any(), { default: {} }),
});

export const provenanceEventSchema = z.object({
  event: z.enum(["ingest", "render", "transcode", "distribute", "edit", "approve"]),
  occurredAt: z.string().datetime(),
  actor: provenanceActorSchema,
  notes: z.string().optional(),
  data: metadataRecord(),
});

export const provenanceEventType = Type.Object({
  event: Type.Union([
    Type.Literal("ingest"),
    Type.Literal("render"),
    Type.Literal("transcode"),
    Type.Literal("distribute"),
    Type.Literal("edit"),
    Type.Literal("approve"),
  ]),
  occurredAt: Type.String({ format: "date-time" }),
  actor: provenanceActorType,
  notes: Type.Optional(Type.String()),
  data: Type.Record(Type.String(), Type.Any(), { default: {} }),
});

export const provenanceAttachmentSchema = z.object({
  name: z.string().min(1),
  asset: jobAssetReferenceSchema,
  role: z.enum(["source", "output", "thumbnail", "caption", "subtitle"]).optional(),
});

export const provenanceAttachmentType = Type.Object({
  name: Type.String({ minLength: 1 }),
  asset: jobAssetReferenceType,
  role: Type.Optional(
    Type.Union([
      Type.Literal("source"),
      Type.Literal("output"),
      Type.Literal("thumbnail"),
      Type.Literal("caption"),
      Type.Literal("subtitle"),
    ]),
  ),
});

export const provenanceRecordSchema = z.object({
  jobId: uuidSchema,
  scriptId: uuidSchema.optional(),
  campaignId: uuidSchema.optional(),
  figureId: uuidSchema.optional(),
  orgId: uuidSchema,
  workspaceId: uuidSchema,
  transcodePreset: z.string().optional(),
  runtimeSeconds: z.number().nonnegative().optional(),
  sourceModel: z.string().optional(),
  checksum: z.string().optional(),
  assets: z.array(jobAssetReferenceSchema).default([]),
  attachments: z.array(provenanceAttachmentSchema).default([]),
  events: z.array(provenanceEventSchema).default([]),
  metadata: metadataRecord(),
});

export const provenanceRecordType = Type.Object({
  jobId: uuidType,
  scriptId: Type.Optional(uuidType),
  campaignId: Type.Optional(uuidType),
  figureId: Type.Optional(uuidType),
  orgId: uuidType,
  workspaceId: uuidType,
  transcodePreset: Type.Optional(Type.String()),
  runtimeSeconds: Type.Optional(Type.Number({ minimum: 0 })),
  sourceModel: Type.Optional(Type.String()),
  checksum: Type.Optional(Type.String()),
  assets: Type.Array(jobAssetReferenceType, { default: [] }),
  attachments: Type.Array(provenanceAttachmentType, { default: [] }),
  events: Type.Array(provenanceEventType, { default: [] }),
  metadata: Type.Record(Type.String(), Type.Any(), { default: {} }),
});

export type ProvenanceRecord = z.infer<typeof provenanceRecordSchema>;
