import { z } from "zod";

import { MAX_ASSET_BACKSTORY_LENGTH } from "../../../shared/assets";

const recognitionProviderNameSchema = z.enum(["aws-rekognition", "fake"]);

const boundingBoxSchema = z.object({
  left: z.number().min(0).max(1),
  top: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

const recognizedFaceSchema = z.object({
  candidateName: z.string().nullable(),
  providerPersonId: z.string().nullable(),
  confidence: z.number().min(0).max(100).nullable(),
  confidenceKind: z.enum(["provider-score", "model-estimate"]),
  recognitionStatus: z.enum(["recognized", "uncertain", "unknown"]),
  boundingBox: boundingBoxSchema.nullable(),
});

const recognitionResultSchema = z.object({
  schemaVersion: z.literal("1.0"),
  provider: recognitionProviderNameSchema,
  model: z.string(),
  faces: z.array(recognizedFaceSchema),
  unrecognizedFaceCount: z.number().int().nonnegative(),
  warnings: z.array(z.string()),
});

export const assetIdSchema = z.string().regex(/^[a-f\d]{24}$/i);

export const assetSourceTextSchema = z.object({
  title: z.string().max(500).nullable(),
  caption: z.string().max(5_000).nullable(),
  altText: z.string().max(2_000).nullable(),
  backstory: z.string().max(MAX_ASSET_BACKSTORY_LENGTH).nullable(),
  revision: z.number().int().positive(),
});

const assetRecognitionStatusSchema = z.enum([
  "QUEUED",
  "PROCESSING",
  "SUCCEEDED",
  "SKIPPED",
  "FAILED",
  "INDETERMINATE",
]);

const assetLinksSchema = z.object({
  self: z.string(),
  image: z.string(),
  admin: z.string(),
});

const assetSchema = z.object({
  assetId: assetIdSchema,
  originalFilename: z.string(),
  mimeType: z.enum(["image/jpeg", "image/png"]),
  sizeBytes: z.number().int().positive(),
  sourceText: assetSourceTextSchema,
  recognitionStatus: assetRecognitionStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  links: assetLinksSchema,
});

const assetRecognitionErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
  recordedAt: z.string().datetime(),
});

const assetRecognitionSchema = z.object({
  status: assetRecognitionStatusSchema,
  provider: recognitionProviderNameSchema,
  attemptNumber: z.number().int().nonnegative(),
  revision: z.number().int().positive(),
  completedAt: z.string().datetime().nullable(),
  lastError: assetRecognitionErrorSchema.nullable(),
  result: recognitionResultSchema.nullable(),
});

const assetCelebrityAssociationSchema = z.object({
  confidence: z.number().min(0).max(100).nullable(),
  decision: z.enum(["APPROVED", "NEEDS_REVIEW"]),
  displayName: z.string().min(1),
  evidenceFields: z.array(z.enum(["title", "caption"])),
  identityKey: z.string().min(1),
  providerPersonId: z.string().min(1).nullable(),
  searchDecision: z.enum(["APPROVED", "NEEDS_REVIEW"]),
  source: z.enum(["recognition", "metadata-inference"]),
});

const assetEnrichmentSchema = z.object({
  associations: z.array(assetCelebrityAssociationSchema),
  decisionEngineVersion: z.number().int().positive().nullable(),
  evaluatedAt: z.string().datetime().nullable(),
  hideFromSearch: z.boolean(),
  recognitionRevision: z.number().int().positive().nullable(),
  sourceTextRevision: z.number().int().positive().nullable(),
});

export const assetDetailSchema = assetSchema.extend({
  enrichment: assetEnrichmentSchema,
  recognition: assetRecognitionSchema,
});

const assetUploadResultSchema = assetSchema.extend({
  created: z.boolean(),
});

export const assetUploadResponseSchema = z.object({
  assets: z.array(assetUploadResultSchema),
});

export const assetMetadataUpdateSchema = z
  .object({
    title: z.string().max(500).nullable().optional(),
    caption: z.string().max(5_000).nullable().optional(),
    altText: z.string().max(2_000).nullable().optional(),
    backstory: z.string().max(MAX_ASSET_BACKSTORY_LENGTH).nullable().optional(),
    hideFromSearch: z.boolean().optional(),
  })
  .strict()
  .refine(
    (metadata) => Object.values(metadata).some((value) => value !== undefined),
    "Provide at least one metadata field.",
  );

export type AssetDetail = z.infer<typeof assetDetailSchema>;
export type AssetMetadataUpdate = z.infer<typeof assetMetadataUpdateSchema>;
export type AssetSourceText = z.infer<typeof assetSourceTextSchema>;
export type AssetUploadResult = z.infer<typeof assetUploadResultSchema>;
