import type { Collection, Db, Document } from "mongodb";

import {
  canonicalEventNames,
  type CanonicalEventId,
  type GalleryEventContext,
} from "../../shared/galleries.js";
import type { AssetCelebrityAssociation } from "./AssetRepository.js";
import { collectionNames } from "../database/indexes.js";
import type { GalleryUsageRepository, SyncGalleryUsagesInput } from "./GalleryUsageRepository.js";
import type {
  VersoSearchCursor,
  VersoSearchFilters,
  VersoSearchRepository,
  VersoSearchRepositoryItem,
  VersoSearchRepositoryPage,
} from "./VersoSearchRepository.js";

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

interface AggregatedGalleryUsage extends GalleryUsageDocument {
  asset: {
    enrichment: {
      associations: AssetCelebrityAssociation[];
    };
    ingest: {
      originalFilename: string;
    };
    sourceText: VersoSearchRepositoryItem["sourceText"];
    storage: {
      mimeType: VersoSearchRepositoryItem["mimeType"];
    };
  };
}

export class MongoGalleryUsageRepository implements GalleryUsageRepository, VersoSearchRepository {
  readonly #galleryUsages: Collection<GalleryUsageDocument>;

  constructor(database: Db) {
    this.#galleryUsages = database.collection<GalleryUsageDocument>(collectionNames.galleryUsages);
  }

  async findLatestEventContext(assetId: string): Promise<GalleryEventContext | null> {
    const usage = await this.#galleryUsages.findOne(
      {
        assetId,
        event: { $ne: null },
        year: { $ne: null },
      },
      { sort: { updatedAt: -1, galleryId: -1 } },
    );
    if (!usage?.event || usage.year === null) {
      return null;
    }

    return {
      id: usage.event,
      name: usage.eventName ?? canonicalEventNames[usage.event],
      year: usage.year,
    };
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

  async countApprovedCelebrityAssets({
    celebritySlug,
    decisionEngineVersion,
    filters,
  }: {
    celebritySlug: string;
    decisionEngineVersion: number;
    filters: VersoSearchFilters;
  }): Promise<number> {
    const [result] = await this.#galleryUsages
      .aggregate<{ total: number }>([
        { $match: createPublishedUsageFilter(filters) },
        { $group: { _id: "$assetId" } },
        { $project: { _id: 0, assetId: "$_id" } },
        createApprovedAssetLookup(celebritySlug, decisionEngineVersion),
        { $unwind: "$asset" },
        { $count: "total" },
      ])
      .toArray();

    return result?.total ?? 0;
  }

  async findApprovedCelebrityUsages({
    celebritySlug,
    cursor,
    decisionEngineVersion,
    filters,
    limit,
  }: {
    celebritySlug: string;
    cursor?: VersoSearchCursor;
    decisionEngineVersion: number;
    filters: VersoSearchFilters;
    limit: number;
  }): Promise<VersoSearchRepositoryPage> {
    const documents = await this.#galleryUsages
      .aggregate<AggregatedGalleryUsage>([
        {
          $match: {
            ...createPublishedUsageFilter(filters),
            ...createCursorFilter(cursor),
          },
        },
        { $sort: { addedAt: -1, assetId: -1, galleryId: -1 } },
        createApprovedAssetLookup(celebritySlug, decisionEngineVersion),
        { $unwind: "$asset" },
        { $limit: limit + 1 },
      ])
      .toArray();
    const hasMore = documents.length > limit;

    return {
      hasMore,
      items: documents.slice(0, limit).map(toSearchRepositoryItem),
    };
  }
}

function createPublishedUsageFilter(filters: VersoSearchFilters): Document {
  return {
    published: true,
    ...(filters.event ? { event: filters.event } : {}),
    ...(filters.year ? { year: filters.year } : {}),
  };
}

function createApprovedAssetLookup(
  celebritySlug: string,
  decisionEngineVersion: number,
): Document {
  return {
    $lookup: {
      as: "asset",
      from: collectionNames.assets,
      let: {
        assetObjectId: {
          $convert: {
            input: "$assetId",
            onError: null,
            onNull: null,
            to: "objectId",
          },
        },
      },
      pipeline: [
        {
          $match: {
            "enrichment.associations": {
              $elemMatch: {
                identityKey: celebritySlug,
                $or: [
                  { searchDecision: "APPROVED" },
                  {
                    decision: "APPROVED",
                    searchDecision: { $exists: false },
                  },
                ],
              },
            },
            "enrichment.decisionEngineVersion": decisionEngineVersion,
            "enrichment.hideFromSearch": { $ne: true },
            "recognition.status": "SUCCEEDED",
            $expr: {
              $and: [
                { $eq: ["$_id", "$$assetObjectId"] },
                { $eq: ["$enrichment.recognitionRevision", "$recognition.revision"] },
                { $eq: ["$enrichment.sourceTextRevision", "$sourceText.revision"] },
              ],
            },
          },
        },
        {
          $project: {
            "enrichment.associations": 1,
            "ingest.originalFilename": 1,
            "sourceText.altText": 1,
            "sourceText.caption": 1,
            "sourceText.title": 1,
            "storage.mimeType": 1,
          },
        },
      ],
    },
  };
}

function createCursorFilter(cursor: VersoSearchCursor | undefined): Document {
  if (!cursor) {
    return {};
  }

  return {
    $or: [
      { addedAt: { $lt: cursor.addedAt } },
      { addedAt: cursor.addedAt, assetId: { $lt: cursor.assetId } },
      {
        addedAt: cursor.addedAt,
        assetId: cursor.assetId,
        galleryId: { $lt: cursor.galleryId },
      },
    ],
  };
}

function toSearchRepositoryItem(document: AggregatedGalleryUsage): VersoSearchRepositoryItem {
  return {
    addedAt: document.addedAt,
    assetId: document.assetId,
    associations: document.asset.enrichment.associations.map((association) => ({
      ...association,
      searchDecision: association.searchDecision ?? association.decision,
    })),
    event: document.event ?? null,
    eventName: document.eventName ?? null,
    galleryId: document.galleryId,
    mimeType: document.asset.storage.mimeType,
    originalFilename: document.asset.ingest.originalFilename,
    sourceText: document.asset.sourceText,
    year: document.year ?? null,
  };
}
