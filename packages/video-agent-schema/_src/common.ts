import type { TSchema } from "@sinclair/typebox";
import { Type } from "@sinclair/typebox";
import { z } from "zod";

export const literalUnion = <T extends readonly string[]>(values: T): TSchema =>
  Type.Union(
    values.map((value) => Type.Literal(value)) as [
      ReturnType<typeof Type.Literal>,
      ...ReturnType<typeof Type.Literal>[]
    ],
  );

export const uuidSchema = z.string().uuid();
export const uuidType = Type.String({ format: "uuid" });

export const jobKindValues = [
  "render",
  "revision",
  "distribution",
] as const;

export const jobStatusValues = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const;

export const scriptStatusValues = [
  "draft",
  "approved",
  "retired",
] as const;

export const approvalStatusValues = [
  "pending",
  "approved",
  "rejected",
] as const;

export const editStatusValues = [
  "pending",
  "applied",
  "rejected",
] as const;

export const storageBucketValues = [
  "figures",
  "products",
  "masters",
  "whatsapp",
  "captions",
  "provenance",
] as const;

export const distributionChannelValues = [
  "whatsapp",
  "email",
  "s3",
  "supabase",
  "manual",
] as const;

export const JobKindSchema = z.enum(jobKindValues);
export const JobStatusSchema = z.enum(jobStatusValues);
export const ScriptStatusSchema = z.enum(scriptStatusValues);
export const ApprovalStatusSchema = z.enum(approvalStatusValues);
export const EditStatusSchema = z.enum(editStatusValues);
export const StorageBucketSchema = z.enum(storageBucketValues);
export const DistributionChannelSchema = z.enum(distributionChannelValues);

export const JobKindType = literalUnion(jobKindValues);
export const JobStatusType = literalUnion(jobStatusValues);
export const ScriptStatusType = literalUnion(scriptStatusValues);
export const ApprovalStatusType = literalUnion(approvalStatusValues);
export const EditStatusType = literalUnion(editStatusValues);
export const StorageBucketType = literalUnion(storageBucketValues);
export const DistributionChannelType = literalUnion(distributionChannelValues);

export type JobKind = z.infer<typeof JobKindSchema>;
export type JobStatus = z.infer<typeof JobStatusSchema>;
export type ScriptStatus = z.infer<typeof ScriptStatusSchema>;
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;
export type EditStatus = z.infer<typeof EditStatusSchema>;
export type StorageBucket = z.infer<typeof StorageBucketSchema>;
export type DistributionChannel = z.infer<typeof DistributionChannelSchema>;
