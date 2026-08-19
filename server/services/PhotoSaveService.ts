import { canonicalEventNames } from "../../shared/galleries.js";
import type { PhotoSaveRequest, PhotoSaveResponse } from "../../shared/photoSave.js";
import type { AssetService } from "./AssetService.js";
import type { GalleryService } from "./GalleryService.js";

interface PhotoSaveServiceDependencies {
  assetService: Pick<AssetService, "updateMetadata">;
  galleryService: Pick<GalleryService, "syncContext">;
}

export class PhotoSaveService {
  readonly #assetService: Pick<AssetService, "updateMetadata">;
  readonly #galleryService: Pick<GalleryService, "syncContext">;

  constructor({ assetService, galleryService }: PhotoSaveServiceDependencies) {
    this.#assetService = assetService;
    this.#galleryService = galleryService;
  }

  async save(assetId: string, update: PhotoSaveRequest): Promise<PhotoSaveResponse> {
    const asset = await this.#assetService.updateMetadata(assetId, update.metadata);
    if (!update.eventMetadata) {
      return { asset, eventMetadata: null };
    }

    const eventName = canonicalEventNames[update.eventMetadata.id];
    const gallery = await this.#galleryService.syncContext(`copilot-photo-${assetId}`, {
      assetIds: [assetId],
      published: true,
      tags: [`${eventName} ${update.eventMetadata.year}`],
    });

    return {
      asset,
      eventMetadata: { event: gallery.event },
    };
  }
}
