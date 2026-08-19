import type {
  GalleryAssetRemovalResponse,
  GalleryContextResponse,
  GalleryContextUpdate,
} from "../../shared/galleries.js";
import { ApiError } from "../middleware/error-handler.js";
import { resolveGalleryEvent } from "../modules/gallery/resolveGalleryEvent.js";
import type { GalleryAssetRepository } from "../repositories/GalleryAssetRepository.js";
import type { GalleryUsageRepository } from "../repositories/GalleryUsageRepository.js";

interface GalleryServiceDependencies {
  assetRepository: GalleryAssetRepository;
  usageRepository: GalleryUsageRepository;
  clock?: () => Date;
}

export class GalleryService {
  readonly #assetRepository: GalleryAssetRepository;
  readonly #clock: () => Date;
  readonly #galleryOperations = new Map<string, Promise<void>>();
  readonly #usageRepository: GalleryUsageRepository;

  constructor({
    assetRepository,
    clock = () => new Date(),
    usageRepository,
  }: GalleryServiceDependencies) {
    this.#assetRepository = assetRepository;
    this.#clock = clock;
    this.#usageRepository = usageRepository;
  }

  syncContext(galleryId: string, update: GalleryContextUpdate): Promise<GalleryContextResponse> {
    return this.#serialize(galleryId, async () => {
      const resolution = resolveGalleryEvent(update.tags);
      if (resolution.status === "AMBIGUOUS") {
        throw new ApiError(
          400,
          "AMBIGUOUS_GALLERY_EVENT",
          "Gallery tags resolve to more than one event or year.",
        );
      }

      const existingAssetIds = await this.#assetRepository.findExistingAssetIds(update.assetIds);
      if (existingAssetIds.size !== update.assetIds.length) {
        throw new ApiError(
          404,
          "GALLERY_ASSET_NOT_FOUND",
          "One or more gallery assets do not exist.",
        );
      }

      const event = resolution.status === "RESOLVED" ? resolution.event : null;
      await this.#usageRepository.syncGallery({
        assetIds: update.assetIds,
        event: event?.id ?? null,
        eventName: event?.name ?? null,
        galleryId,
        published: update.published,
        updatedAt: this.#clock(),
        year: event?.year ?? null,
      });

      return {
        assetCount: update.assetIds.length,
        event,
        galleryId,
        published: update.published,
      };
    });
  }

  removeAsset(galleryId: string, assetId: string): Promise<GalleryAssetRemovalResponse> {
    return this.#serialize(galleryId, async () => ({
      assetId,
      galleryId,
      removed: await this.#usageRepository.removeAsset(galleryId, assetId),
    }));
  }

  async #serialize<T>(galleryId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.#galleryOperations.get(galleryId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    const tail = current.then(
      () => undefined,
      () => undefined,
    );
    this.#galleryOperations.set(galleryId, tail);

    try {
      return await current;
    } finally {
      if (this.#galleryOperations.get(galleryId) === tail) {
        this.#galleryOperations.delete(galleryId);
      }
    }
  }
}
