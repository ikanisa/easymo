import { Type } from "@sinclair/typebox";
import { z } from "zod";

import {
  ScriptStatusSchema,
  ScriptStatusType,
  uuidSchema,
  uuidType,
} from "./common";
import {
  jobAssetReferenceSchema,
  jobAssetReferenceType,
} from "./jobs";

const metadataRecord = () => z.record(z.string(), z.unknown()).default({});

export const scriptSegmentSchema = z.object({
  id: uuidSchema.optional(),
  type: z.enum(["scene", "narration", "cta", "stage_direction", "broll"]),
  content: z.string().min(1),
  durationSeconds: z.number().positive().optional(),
  spokenByFigureId: uuidSchema.optional(),
  assetReferences: z.array(jobAssetReferenceSchema).default([]),
  annotations: metadataRecord(),
});

export type ScriptSegment = z.infer<typeof scriptSegmentSchema>;

export const scriptSegmentType = Type.Object({
  id: Type.Optional(uuidType),
  type: Type.Union([
    Type.Literal("scene"),
    Type.Literal("narration"),
    Type.Literal("cta"),
    Type.Literal("stage_direction"),
    Type.Literal("broll"),
  ]),
  content: Type.String({ minLength: 1 }),
  durationSeconds: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
  spokenByFigureId: Type.Optional(uuidType),
  assetReferences: Type.Array(jobAssetReferenceType, { default: [] }),
  annotations: Type.Record(Type.String(), Type.Any(), { default: {} }),
});

export const scriptBeatSchema = z.object({
  label: z.string().min(1),
  summary: z.string().min(1),
  segmentId: uuidSchema.optional(),
  objectives: z.array(z.string().min(1)).default([]),
});

export const scriptBeatType = Type.Object({
  label: Type.String({ minLength: 1 }),
  summary: Type.String({ minLength: 1 }),
  segmentId: Type.Optional(uuidType),
  objectives: Type.Array(Type.String({ minLength: 1 }), { default: [] }),
});

export const scriptDocumentSchema = z.object({
  scriptId: uuidSchema,
  version: z.number().int().positive().default(1),
  language: z.string().min(2).default("en-US"),
  status: ScriptStatusSchema.default("draft"),
  title: z.string().optional(),
  description: z.string().optional(),
  segments: z.array(scriptSegmentSchema).min(1),
  beats: z.array(scriptBeatSchema).default([]),
  heroProductIds: z.array(uuidSchema).default([]),
  callToAction: z
    .object({
      headline: z.string().optional(),
      link: z.string().url().optional(),
      deadline: z.string().datetime().optional(),
    })
    .partial()
    .default({}),
  metadata: metadataRecord(),
});

export const scriptDocumentType = Type.Object({
  scriptId: uuidType,
  version: Type.Integer({ minimum: 1, default: 1 }),
  language: Type.String({ minLength: 2, default: "en-US" }),
  status: ScriptStatusType,
  title: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  segments: Type.Array(scriptSegmentType, { minItems: 1 }),
  beats: Type.Array(scriptBeatType, { default: [] }),
  heroProductIds: Type.Array(uuidType, { default: [] }),
  callToAction: Type.Object(
    {
      headline: Type.Optional(Type.String()),
      link: Type.Optional(Type.String({ format: "uri" })),
      deadline: Type.Optional(Type.String({ format: "date-time" })),
    },
    { default: {} },
  ),
  metadata: Type.Record(Type.String(), Type.Any(), { default: {} }),
});

export const scriptPayloadSchema = z.object({
  orgId: uuidSchema,
  workspaceId: uuidSchema,
  campaignId: uuidSchema.optional(),
  figureId: uuidSchema.optional(),
  document: scriptDocumentSchema,
});

export const scriptPayloadType = Type.Object({
  orgId: uuidType,
  workspaceId: uuidType,
  campaignId: Type.Optional(uuidType),
  figureId: Type.Optional(uuidType),
  document: scriptDocumentType,
});

export type ScriptDocument = z.infer<typeof scriptDocumentSchema>;
export type ScriptPayload = z.infer<typeof scriptPayloadSchema>;
