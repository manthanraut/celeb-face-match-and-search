import { z } from "zod";

import { assetIdSchema } from "../../shared/assets.js";
import { canonicalEventIdSchema, galleryIdSchema } from "../../shared/galleries.js";
import {
  celebritySlugSchema,
  type CelebrityArchiveQuery,
  type CelebrityArchiveResponse,
  type CelebritySearchQuery,
  type CelebritySearchResponse,
  type VersoCelebrity,
  type VersoSearchAsset,
} from "../../shared/search.js";
import { ApiError } from "../middleware/error-handler.js";
import {
  CELEBRITY_DECISION_ENGINE_VERSION,
  normalizeIdentityText,
} from "../modules/enrichment/decisionEngine.js";
import type {
  CelebrityCatalogEntry,
  CelebrityLookupRepository,
} from "../repositories/CelebrityRepository.js";
import type {
  VersoSearchCursor,
  VersoSearchFilters,
  VersoSearchRepository,
  VersoSearchRepositoryItem,
} from "../repositories/VersoSearchRepository.js";

interface VersoSearchServiceDependencies {
  celebrityRepository: CelebrityLookupRepository;
  searchRepository: VersoSearchRepository;
}

const cursorPayloadSchema = z
  .object({
    addedAt: z.string().datetime(),
    assetId: assetIdSchema,
    celebritySlug: celebritySlugSchema,
    event: canonicalEventIdSchema.nullable(),
    galleryId: galleryIdSchema,
    version: z.literal(1),
    year: z.number().int().min(1900).max(2199).nullable(),
  })
  .strict();

export class VersoSearchService {
  readonly #celebrityRepository: CelebrityLookupRepository;
  readonly #searchRepository: VersoSearchRepository;

  constructor({ celebrityRepository, searchRepository }: VersoSearchServiceDependencies) {
    this.#celebrityRepository = celebrityRepository;
    this.#searchRepository = searchRepository;
  }

  async search(query: CelebritySearchQuery): Promise<CelebritySearchResponse> {
    const normalizedQuery = normalizeIdentityText(query.query);
    const matches = await this.#celebrityRepository.findByNormalizedIdentity(normalizedQuery);
    if (matches.length === 0) {
      return {
        celebrity: null,
        items: [],
        nextCursor: null,
        query: query.query,
        total_count: 0,
      };
    }
    if (matches.length > 1) {
      throw new ApiError(
        409,
        "AMBIGUOUS_CELEBRITY_QUERY",
        "The search query matches more than one celebrity.",
      );
    }

    const page = await this.#findCelebrityPage(matches[0], query);
    return { ...page, query: query.query };
  }

  async getCelebrityArchive(
    celebritySlug: string,
    query: CelebrityArchiveQuery,
  ): Promise<CelebrityArchiveResponse> {
    const celebrity = await this.#celebrityRepository.findBySlug(celebritySlug);
    if (!celebrity) {
      throw new ApiError(404, "CELEBRITY_NOT_FOUND", "The celebrity could not be found.");
    }

    return this.#findCelebrityPage(celebrity, query);
  }

  async #findCelebrityPage(
    celebrity: CelebrityCatalogEntry,
    query: CelebrityArchiveQuery,
  ): Promise<CelebrityArchiveResponse> {
    const filters: VersoSearchFilters = {
      event: query.event,
      year: query.year,
    };
    const cursor = query.cursor
      ? decodeCursor(query.cursor, celebrity.slug, filters)
      : undefined;
    const [page, totalCount] = await Promise.all([
      this.#searchRepository.findApprovedCelebrityUsages({
        celebritySlug: celebrity.slug,
        cursor,
        decisionEngineVersion: CELEBRITY_DECISION_ENGINE_VERSION,
        filters,
        limit: query.limit,
      }),
      this.#searchRepository.countApprovedCelebrityAssets({
        celebritySlug: celebrity.slug,
        decisionEngineVersion: CELEBRITY_DECISION_ENGINE_VERSION,
        filters,
      }),
    ]);
    const lastItem = page.items.at(-1);

    return {
      celebrity: toVersoCelebrity(celebrity),
      items: page.items.map(toVersoSearchAsset),
      nextCursor:
        page.hasMore && lastItem
          ? encodeCursor(lastItem, celebrity.slug, filters)
          : null,
      total_count: totalCount,
    };
  }
}

function toVersoCelebrity(celebrity: CelebrityCatalogEntry): VersoCelebrity {
  return {
    displayName: celebrity.displayName,
    slug: celebrity.slug,
  };
}

function toVersoSearchAsset(item: VersoSearchRepositoryItem): VersoSearchAsset {
  const celebrities = item.associations
    .filter(({ searchDecision }) => searchDecision === "APPROVED")
    .map(({ displayName, identityKey }) => ({ displayName, slug: identityKey }))
    .sort((first, second) =>
      first.displayName.localeCompare(second.displayName, "en-US") ||
      first.slug.localeCompare(second.slug, "en-US"),
    );

  return {
    assetId: item.assetId,
    celebrities,
    event:
      item.event && item.eventName && item.year
        ? { id: item.event, name: item.eventName, year: item.year }
        : null,
    links: {
      image: `/api/assets/${item.assetId}/image`,
      self: `/api/assets/${item.assetId}`,
    },
    mimeType: item.mimeType,
    originalFilename: item.originalFilename,
    sourceGallery: {
      addedAt: item.addedAt.toISOString(),
      galleryId: item.galleryId,
    },
    sourceText: item.sourceText,
  };
}

function encodeCursor(
  item: VersoSearchRepositoryItem,
  celebritySlug: string,
  filters: VersoSearchFilters,
): string {
  return Buffer.from(
    JSON.stringify({
      addedAt: item.addedAt.toISOString(),
      assetId: item.assetId,
      celebritySlug,
      event: filters.event ?? null,
      galleryId: item.galleryId,
      version: 1,
      year: filters.year ?? null,
    }),
  ).toString("base64url");
}

function decodeCursor(
  encodedCursor: string,
  celebritySlug: string,
  filters: VersoSearchFilters,
): VersoSearchCursor {
  try {
    const payload = cursorPayloadSchema.parse(
      JSON.parse(Buffer.from(encodedCursor, "base64url").toString("utf8")),
    );
    if (
      payload.celebritySlug !== celebritySlug ||
      payload.event !== (filters.event ?? null) ||
      payload.year !== (filters.year ?? null)
    ) {
      throw new Error("Cursor context mismatch.");
    }

    return {
      addedAt: new Date(payload.addedAt),
      assetId: payload.assetId,
      galleryId: payload.galleryId,
    };
  } catch {
    throw new ApiError(400, "INVALID_SEARCH_CURSOR", "The search cursor is invalid.");
  }
}
