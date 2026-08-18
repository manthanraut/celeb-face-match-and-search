import { z } from "zod";

import { assetIdSchema, assetImageMimeTypeSchema } from "./assets.js";
import { canonicalEventIdSchema, galleryEventContextSchema, galleryIdSchema } from "./galleries.js";

export const celebritySlugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Celebrity slug must use lowercase letters, numbers, and hyphens.");

const searchPageQueryShape = {
  cursor: z.string().min(1).max(1_000).optional(),
  event: canonicalEventIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  year: z.coerce.number().int().min(1900).max(2199).optional(),
};

export const celebritySearchQuerySchema = z
  .object({
    ...searchPageQueryShape,
    query: z.string().trim().min(1).max(200),
  })
  .strict();

export const celebrityArchiveQuerySchema = z.object(searchPageQueryShape).strict();

export const versoCelebritySchema = z.object({
  displayName: z.string().min(1),
  slug: celebritySlugSchema,
});

export const versoSearchAssetSchema = z.object({
  assetId: assetIdSchema,
  celebrities: z.array(versoCelebritySchema).min(1),
  event: galleryEventContextSchema.nullable(),
  links: z.object({
    image: z.string(),
    self: z.string(),
  }),
  mimeType: assetImageMimeTypeSchema,
  originalFilename: z.string(),
  sourceGallery: z.object({
    addedAt: z.string().datetime(),
    galleryId: galleryIdSchema,
  }),
  sourceText: z.object({
    altText: z.string().nullable(),
    caption: z.string().nullable(),
    title: z.string().nullable(),
  }),
});

const versoSearchPageShape = {
  celebrity: versoCelebritySchema,
  items: z.array(versoSearchAssetSchema),
  nextCursor: z.string().nullable(),
};

export const celebritySearchResponseSchema = z.object({
  ...versoSearchPageShape,
  celebrity: versoCelebritySchema.nullable(),
  query: z.string(),
});

export const celebrityArchiveResponseSchema = z.object(versoSearchPageShape);

export type CelebrityArchiveQuery = z.infer<typeof celebrityArchiveQuerySchema>;
export type CelebrityArchiveResponse = z.infer<typeof celebrityArchiveResponseSchema>;
export type CelebritySearchQuery = z.infer<typeof celebritySearchQuerySchema>;
export type CelebritySearchResponse = z.infer<typeof celebritySearchResponseSchema>;
export type VersoCelebrity = z.infer<typeof versoCelebritySchema>;
export type VersoSearchAsset = z.infer<typeof versoSearchAssetSchema>;
