import { z } from "zod";

import {
  recognitionProviderNameSchema,
  recognitionResultSchema,
} from "./contracts/recognition.js";

export const MAX_ASSET_UPLOAD_FILES = 10;
export const MAX_ASSET_UPLOAD_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_ASSET_IMAGE_DIMENSION = 10_000;
export const MAX_ASSET_IMAGE_PIXELS = 50_000_000;

export const assetIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Asset ID must be a 24-character hexadecimal value.");
export const clientAssetIdSchema = z.string().uuid();
export const assetImageMimeTypeSchema = z.enum(["image/jpeg", "image/png"]);
export const assetRecognitionStatusSchema = z.enum([
  "QUEUED",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "INDETERMINATE",
]);

export const assetSourceTextSchema = z.object({
  title: z.string().max(500).nullable(),
  caption: z.string().max(5_000).nullable(),
  altText: z.string().max(2_000).nullable(),
  revision: z.number().int().positive(),
});

export const assetLinksSchema = z.object({
  self: z.string(),
  image: z.string(),
  admin: z.string(),
});

export const assetSchema = z.object({
  assetId: assetIdSchema,
  originalFilename: z.string(),
  mimeType: assetImageMimeTypeSchema,
  sizeBytes: z.number().int().positive(),
  sourceText: assetSourceTextSchema,
  recognitionStatus: assetRecognitionStatusSchema,
  searchReady: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  links: assetLinksSchema,
});

export const assetRecognitionErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
  recordedAt: z.string().datetime(),
});

export const assetRecognitionSchema = z.object({
  status: assetRecognitionStatusSchema,
  provider: recognitionProviderNameSchema,
  attemptNumber: z.number().int().nonnegative(),
  revision: z.number().int().positive(),
  completedAt: z.string().datetime().nullable(),
  lastError: assetRecognitionErrorSchema.nullable(),
  result: recognitionResultSchema.nullable(),
});

export const assetDetailSchema = assetSchema.extend({
  recognition: assetRecognitionSchema,
});

export const assetUploadManifestSchema = z
  .array(
    z.object({
      clientAssetId: clientAssetIdSchema,
    }),
  )
  .min(1)
  .max(MAX_ASSET_UPLOAD_FILES)
  .superRefine((items, context) => {
    const seenIds = new Set<string>();

    items.forEach((item, index) => {
      if (seenIds.has(item.clientAssetId)) {
        context.addIssue({
          code: "custom",
          message: "Each clientAssetId must be unique within an upload.",
          path: [index, "clientAssetId"],
        });
      }
      seenIds.add(item.clientAssetId);
    });
  });

export const assetUploadResultSchema = assetSchema.extend({
  created: z.boolean(),
});

export const assetUploadResponseSchema = z.object({
  assets: z.array(assetUploadResultSchema),
});

export const assetListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: assetIdSchema.optional(),
});

export const assetListResponseSchema = z.object({
  assets: z.array(assetSchema),
  nextCursor: assetIdSchema.nullable(),
});

export const assetRecognitionRetryResponseSchema = z.object({
  assetId: assetIdSchema,
  recognitionStatus: z.literal("QUEUED"),
});

export type Asset = z.infer<typeof assetSchema>;
export type AssetDetail = z.infer<typeof assetDetailSchema>;
export type AssetImageMimeType = z.infer<typeof assetImageMimeTypeSchema>;
export type AssetListResponse = z.infer<typeof assetListResponseSchema>;
export type AssetRecognitionStatus = z.infer<typeof assetRecognitionStatusSchema>;
export type AssetUploadManifest = z.infer<typeof assetUploadManifestSchema>;
export type AssetUploadResponse = z.infer<typeof assetUploadResponseSchema>;
export type AssetUploadResult = z.infer<typeof assetUploadResultSchema>;
export type AssetRecognitionRetryResponse = z.infer<
  typeof assetRecognitionRetryResponseSchema
>;
