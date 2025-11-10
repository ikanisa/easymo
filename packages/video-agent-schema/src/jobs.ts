import { Type } from "@sinclair/typebox";
import { z } from "zod";

import {
  DistributionChannelSchema,
  DistributionChannelType,
  JobKindSchema,
  JobKindType,
  JobStatusSchema,
  JobStatusType,
  StorageBucketSchema,
  StorageBucketType,
  uuidSchema,
  uuidType,
} from "./common";

const metadataRecord = () => z.record(z.string(), z.unknown()).default({});

export const jobAssetReferenceSchema = z.object({
  bucket: StorageBucketSchema,
  path: z.string().min(1),
  checksum: z.string().optional(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
});

export type JobAssetReference = z.infer<typeof jobAssetReferenceSchema>;

export const jobAssetReferenceType = Type.Object({
  bucket: StorageBucketType,
  path: Type.String({ minLength: 1 }),
  checksum: Type.Optional(Type.String()),
  mimeType: Type.Optional(Type.String()),
  sizeBytes: Type.Optional(Type.Integer({ minimum: 0 })),
});

export const jobInputSchema = z.object({
  prompt: z.string().min(1, "prompt is required"),
  storyboard: z.array(z.string().min(1)).default([]),
  scriptRevisionId: uuidSchema.nullable().optional(),
  brandGuideId: uuidSchema.nullable().optional(),
  productIds: z.array(uuidSchema).default([]),
  assetReferences: z.array(jobAssetReferenceSchema).default([]),
  options: metadataRecord(),
});

export const jobInputType = Type.Object({
  prompt: Type.String({ minLength: 1 }),
  storyboard: Type.Array(Type.String({ minLength: 1 }), { default: [] }),
  scriptRevisionId: Type.Optional(Type.Union([uuidType, Type.Null()])),
  brandGuideId: Type.Optional(Type.Union([uuidType, Type.Null()])),
  productIds: Type.Array(uuidType, { default: [] }),
  assetReferences: Type.Array(jobAssetReferenceType, { default: [] }),
  options: Type.Record(Type.String(), Type.Any(), { default: {} }),
});

export const jobOutputSchema = z.object({
  targetBucket: StorageBucketSchema.optional(),
  format: z.enum(["mp4", "mov", "gif", "webm", "wav", "mp3"]).optional(),
  transcodePreset: z.string().optional(),
  channels: z.array(DistributionChannelSchema).default([]),
  notifyWebhook: z.string().url().optional(),
});

export const jobOutputType = Type.Object({
  targetBucket: Type.Optional(StorageBucketType),
  format: Type.Optional(
    Type.Union([
      Type.Literal("mp4"),
      Type.Literal("mov"),
      Type.Literal("gif"),
      Type.Literal("webm"),
      Type.Literal("wav"),
      Type.Literal("mp3"),
    ]),
  ),
  transcodePreset: Type.Optional(Type.String()),
  channels: Type.Array(DistributionChannelType, { default: [] }),
  notifyWebhook: Type.Optional(Type.String({ format: "uri" })),
});

const baseJobSpecSchema = z.object({
  jobId: uuidSchema,
  orgId: uuidSchema,
  workspaceId: uuidSchema,
  campaignId: uuidSchema.optional(),
  scriptId: uuidSchema.optional(),
  figureId: uuidSchema.optional(),
  requestedBy: uuidSchema.optional(),
  kind: JobKindSchema,
  status: JobStatusSchema.default("queued"),
  priority: z.number().int().min(0).max(100).default(0),
  requestedAt: z.string().datetime().optional(),
  payload: jobInputSchema,
  output: jobOutputSchema.optional(),
  metadata: metadataRecord(),
});

const baseJobSpecType = Type.Object({
  jobId: uuidType,
  orgId: uuidType,
  workspaceId: uuidType,
  campaignId: Type.Optional(uuidType),
  scriptId: Type.Optional(uuidType),
  figureId: Type.Optional(uuidType),
  requestedBy: Type.Optional(uuidType),
  kind: JobKindType,
  status: JobStatusType,
  priority: Type.Integer({ minimum: 0, maximum: 100, default: 0 }),
  requestedAt: Type.Optional(Type.String({ format: "date-time" })),
  payload: jobInputType,
  output: Type.Optional(jobOutputType),
  metadata: Type.Record(Type.String(), Type.Any(), { default: {} }),
});

export const renderJobSpecSchema = baseJobSpecSchema.extend({
  kind: z.literal("render"),
  payload: jobInputSchema.extend({
    renderProfile: z.string().default("default"),
    runtime: z
      .object({
        durationSeconds: z.number().positive().optional(),
        aspectRatio: z.string().regex(/^[0-9]+:[0-9]+$/).optional(),
        frameRate: z.number().positive().optional(),
      })
      .partial()
      .default({}),
  }),
});

export const renderJobSpecType = Type.Intersect([
  baseJobSpecType,
  Type.Object({
    kind: Type.Literal("render"),
    payload: Type.Intersect([
      jobInputType,
      Type.Object({
        renderProfile: Type.String({ default: "default" }),
        runtime: Type.Object(
          {
            durationSeconds: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
            aspectRatio: Type.Optional(Type.RegExp(/^[0-9]+:[0-9]+$/)),
            frameRate: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
          },
          { default: {} },
        ),
      }),
    ]),
  }),
]);

export const revisionJobSpecSchema = baseJobSpecSchema.extend({
  kind: z.literal("revision"),
  payload: jobInputSchema.extend({
    revisionNotes: z.string().min(1),
    previousJobId: uuidSchema,
    expectedChanges: z.array(z.string().min(1)).default([]),
  }),
});

export const revisionJobSpecType = Type.Intersect([
  baseJobSpecType,
  Type.Object({
    kind: Type.Literal("revision"),
    payload: Type.Intersect([
      jobInputType,
      Type.Object({
        revisionNotes: Type.String({ minLength: 1 }),
        previousJobId: uuidType,
        expectedChanges: Type.Array(Type.String({ minLength: 1 }), {
          default: [],
        }),
      }),
    ]),
  }),
]);

export const distributionJobSpecSchema = baseJobSpecSchema.extend({
  kind: z.literal("distribution"),
  payload: jobInputSchema.extend({
    channels: z.array(DistributionChannelSchema).min(1),
    assets: z.array(jobAssetReferenceSchema).min(1),
    handoffInstructions: z.string().optional(),
  }),
});

export const distributionJobSpecType = Type.Intersect([
  baseJobSpecType,
  Type.Object({
    kind: Type.Literal("distribution"),
    payload: Type.Intersect([
      jobInputType,
      Type.Object({
        channels: Type.Array(DistributionChannelType, { minItems: 1 }),
        assets: Type.Array(jobAssetReferenceType, { minItems: 1 }),
        handoffInstructions: Type.Optional(Type.String()),
      }),
    ]),
  }),
]);

export const jobSpecSchema = z.union([
  renderJobSpecSchema,
  revisionJobSpecSchema,
  distributionJobSpecSchema,
]);

export const jobSpecType = Type.Union([
  renderJobSpecType,
  revisionJobSpecType,
  distributionJobSpecType,
]);

export type JobSpec = z.infer<typeof jobSpecSchema>;
