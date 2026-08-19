import { Router } from "express";

import { assetIdSchema } from "../../shared/assets.js";
import { galleryContextUpdateSchema, galleryIdSchema } from "../../shared/galleries.js";
import type { GalleryService } from "../services/GalleryService.js";

export type GalleryRouteService = Pick<GalleryService, "removeAsset" | "syncContext">;

export function createGalleryRouter(galleryService: GalleryRouteService): Router {
  const galleryRouter = Router();

  galleryRouter.put("/:galleryId/context", async (request, response) => {
    const galleryId = galleryIdSchema.parse(request.params.galleryId);
    const update = galleryContextUpdateSchema.parse(request.body);
    response.json(await galleryService.syncContext(galleryId, update));
  });

  galleryRouter.delete("/:galleryId/assets/:assetId", async (request, response) => {
    const galleryId = galleryIdSchema.parse(request.params.galleryId);
    const assetId = assetIdSchema.parse(request.params.assetId);
    response.json(await galleryService.removeAsset(galleryId, assetId));
  });

  return galleryRouter;
}
