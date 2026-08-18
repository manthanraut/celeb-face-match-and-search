import type { Collection, Db } from "mongodb";

import type { CanonicalEventId } from "../../shared/galleries.js";
import { collectionNames } from "../database/indexes.js";
import type { GalleryUsageRepository, SyncGalleryUsagesInput } from "./GalleryUsageRepository.js";

export interface GalleryUsageDocument {
  addedAt: Date;
  assetId: string;
  event: CanonicalEventId | null;
  eventName: string | null;
  galleryId: string;
  published: boolean;
  updatedAt: Date;
  year: number | null;
}

export class MongoGalleryUsageRepository implements GalleryUsageRepository {
  readonly #galleryUsages: Collection<GalleryUsageDocument>;

  constructor(database: Db) {
    this.#galleryUsages = database.collection<GalleryUsageDocument>(collectionNames.galleryUsages);
  }

  async syncGallery({
    assetIds,
    event,
    eventName,
    galleryId,
    published,
    updatedAt,
    year,
  }: SyncGalleryUsagesInput): Promise<void> {
    if (assetIds.length > 0) {
      await this.#galleryUsages.bulkWrite(
        assetIds.map((assetId) => ({
          updateOne: {
            filter: { assetId, galleryId },
            update: {
              $set: { event, eventName, published, updatedAt, year },
              $setOnInsert: { addedAt: updatedAt, assetId, galleryId },
            },
            upsert: true,
          },
        })),
        { ordered: false },
      );
    }

    await this.#galleryUsages.deleteMany(
      assetIds.length === 0 ? { galleryId } : { assetId: { $nin: [...assetIds] }, galleryId },
    );
  }

  async removeAsset(galleryId: string, assetId: string): Promise<boolean> {
    const result = await this.#galleryUsages.deleteOne({ assetId, galleryId });
    return result.deletedCount === 1;
  }
}
