import type { CanonicalEventId } from "../../shared/galleries.js";

export interface GalleryUsageContext {
  event: CanonicalEventId | null;
  eventName: string | null;
  published: boolean;
  year: number | null;
}

export interface SyncGalleryUsagesInput extends GalleryUsageContext {
  assetIds: readonly string[];
  galleryId: string;
  updatedAt: Date;
}

export interface GalleryUsageRepository {
  removeAsset(galleryId: string, assetId: string): Promise<boolean>;
  syncGallery(input: SyncGalleryUsagesInput): Promise<void>;
}
