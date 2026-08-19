import { z } from "zod";

import { assetDetailSchema, assetMetadataUpdateSchema } from "./assets.js";
import {
  assetEventMetadataResponseSchema,
  galleryEventContextSchema,
} from "./galleries.js";

export const photoSaveRequestSchema = z
  .object({
    eventMetadata: galleryEventContextSchema.optional(),
    metadata: assetMetadataUpdateSchema,
  })
  .strict();

export const photoSaveResponseSchema = z.object({
  asset: assetDetailSchema,
  eventMetadata: assetEventMetadataResponseSchema.nullable(),
});

export type PhotoSaveRequest = z.infer<typeof photoSaveRequestSchema>;
export type PhotoSaveResponse = z.infer<typeof photoSaveResponseSchema>;
