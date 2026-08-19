import { z } from "zod";

import { assetIdSchema } from "./assets.js";

export const canonicalEventIds = [
  "met-gala",
  "grammys",
  "oscars",
  "golden-globes",
  "vogue-world",
] as const;

export const canonicalEventIdSchema = z.enum(canonicalEventIds);
export type CanonicalEventId = z.infer<typeof canonicalEventIdSchema>;

export const canonicalEventNames: Readonly<Record<CanonicalEventId, string>> = {
  "golden-globes": "Golden Globe",
  grammys: "Grammys",
  "met-gala": "Met Gala",
  oscars: "Oscars",
  "vogue-world": "Vogue World",
};

export const galleryIdSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/,
    "Gallery ID may contain letters, numbers, periods, underscores, colons, and hyphens.",
  );

export const galleryContextUpdateSchema = z
  .object({
    assetIds: z.array(assetIdSchema).max(500),
    published: z.boolean(),
    tags: z.array(z.string().trim().min(1).max(200)).max(100),
  })
  .strict()
  .superRefine(({ assetIds }, context) => {
    const seenAssetIds = new Set<string>();
    assetIds.forEach((assetId, index) => {
      if (seenAssetIds.has(assetId)) {
        context.addIssue({
          code: "custom",
          message: "Each asset ID must be unique within a gallery.",
          path: ["assetIds", index],
        });
      }
      seenAssetIds.add(assetId);
    });
  });

export const galleryEventContextSchema = z.object({
  id: canonicalEventIdSchema,
  name: z.string(),
  year: z.number().int().min(1900).max(2199),
});

export const galleryContextResponseSchema = z.object({
  assetCount: z.number().int().nonnegative(),
  event: galleryEventContextSchema.nullable(),
  galleryId: galleryIdSchema,
  published: z.boolean(),
});

export const assetEventMetadataResponseSchema = z.object({
  event: galleryEventContextSchema.nullable(),
});

export const galleryAssetRemovalResponseSchema = z.object({
  assetId: assetIdSchema,
  galleryId: galleryIdSchema,
  removed: z.boolean(),
});

export type GalleryContextUpdate = z.infer<typeof galleryContextUpdateSchema>;
export type GalleryContextResponse = z.infer<typeof galleryContextResponseSchema>;
export type GalleryEventContext = z.infer<typeof galleryEventContextSchema>;
export type AssetEventMetadataResponse = z.infer<typeof assetEventMetadataResponseSchema>;
export type GalleryAssetRemovalResponse = z.infer<typeof galleryAssetRemovalResponseSchema>;
