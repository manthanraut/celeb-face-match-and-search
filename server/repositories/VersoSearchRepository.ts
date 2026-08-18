import type { AssetImageMimeType } from "../../shared/assets.js";
import type { CanonicalEventId } from "../../shared/galleries.js";
import type { AssetCelebrityAssociation } from "./AssetRepository.js";

export interface VersoSearchCursor {
  addedAt: Date;
  assetId: string;
  galleryId: string;
}

export interface VersoSearchFilters {
  event?: CanonicalEventId;
  year?: number;
}

export interface VersoSearchRepositoryItem {
  addedAt: Date;
  assetId: string;
  associations: AssetCelebrityAssociation[];
  event: CanonicalEventId | null;
  eventName: string | null;
  galleryId: string;
  mimeType: AssetImageMimeType;
  originalFilename: string;
  sourceText: {
    altText: string | null;
    caption: string | null;
    title: string | null;
  };
  year: number | null;
}

export interface VersoSearchRepositoryPage {
  hasMore: boolean;
  items: VersoSearchRepositoryItem[];
}

export interface VersoSearchRepository {
  findApprovedCelebrityUsages(options: {
    celebritySlug: string;
    cursor?: VersoSearchCursor;
    decisionEngineVersion: number;
    filters: VersoSearchFilters;
    limit: number;
  }): Promise<VersoSearchRepositoryPage>;
}
