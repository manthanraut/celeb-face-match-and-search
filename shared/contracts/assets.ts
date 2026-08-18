import { z } from "zod";

import { recognitionResultSchema } from "./recognition.js";

export const assetIdSchema = z.string().uuid();

export const sourceTextSchema = z.object({
  title: z.string().nullable(),
  caption: z.string().nullable(),
  altText: z.string().nullable(),
});

export const editorialTextMatchSchema = z.object({
  matched: z.boolean(),
  source: z.enum(["title", "caption", "both"]).nullable(),
});

export const celebrityAssociationSchema = z.object({
  canonicalName: z.string().min(1),
  providerPersonId: z.string().nullable(),
  faceNumber: z.number().int().positive().nullable(),
  identificationSource: z.enum([
    "AI image recognition only",
    "AI image recognition only + Meta",
    "Meta Only",
  ]),
  status: z.enum(["Approved", "Needs Review"]),
  searchDecision: z.enum(["Accepted", "Needs Review"]),
  aiResponse: z
    .object({
      detectedName: z.string().min(1),
      confidence: z.number().min(0).max(100),
    })
    .nullable(),
  editorialTextMatch: editorialTextMatchSchema,
});

export const designerAssociationSchema = z.object({
  name: z.string().min(1),
  evidence: z.string().min(1),
});

export const assetUsageSchema = z.object({
  contentId: z.string().min(1),
  event: z.object({
    eventId: z.string().min(1),
    eventName: z.string().min(1),
    year: z.number().int().min(1900).max(2200).nullable(),
  }),
  addedAt: z.string().datetime(),
});

export const enrichmentStateSchema = z.object({
  imageRecognitionComplete: z.boolean(),
  editorialMetadataProcessed: z.boolean(),
  galleryContextAvailable: z.boolean(),
  searchReady: z.boolean(),
});

export const recognitionJobSchema = z.object({
  status: z.enum(["queued", "processing", "completed", "failed"]),
  provider: z.literal("aws-rekognition"),
  model: z.string(),
  threshold: z.number().min(0).max(100),
  attempt: z.number().int().nonnegative(),
  queuedAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  error: z.string().nullable(),
  rawResponseFile: z.string().nullable(),
  normalizedResult: recognitionResultSchema.nullable(),
});

export const photoAssetSchema = z.object({
  id: assetIdSchema,
  image: z.object({
    originalFileName: z.string().min(1),
    mimeType: z.enum(["image/jpeg", "image/png"]),
    size: z.number().int().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    originalLastModified: z.number().int().nonnegative(),
    storageKey: z.string().min(1),
    url: z.string().min(1),
  }),
  sourceText: sourceTextSchema,
  celebrities: z.array(celebrityAssociationSchema),
  designers: z.array(designerAssociationSchema),
  usages: z.array(assetUsageSchema),
  enrichmentState: enrichmentStateSchema,
  recognition: recognitionJobSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const photoAssetResponseSchema = z.object({
  asset: photoAssetSchema,
  rawRecognitionResponse: z.unknown().nullable(),
});

export const updateSourceTextInputSchema = sourceTextSchema.partial();

export type CelebrityAssociation = z.infer<typeof celebrityAssociationSchema>;
export type PhotoAsset = z.infer<typeof photoAssetSchema>;
export type PhotoAssetResponse = z.infer<typeof photoAssetResponseSchema>;
export type SourceText = z.infer<typeof sourceTextSchema>;
export type UpdateSourceTextInput = z.infer<typeof updateSourceTextInputSchema>;
