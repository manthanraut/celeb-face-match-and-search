import { describe, expect, it, vi } from "vitest";

import type {
  CelebrityCatalogEntry,
  CelebrityLookupRepository,
} from "../../server/repositories/CelebrityRepository.js";
import type {
  VersoSearchRepository,
  VersoSearchRepositoryItem,
} from "../../server/repositories/VersoSearchRepository.js";
import { VersoSearchService } from "../../server/services/VersoSearchService.js";

const RIHANNA: CelebrityCatalogEntry = {
  displayName: "Rihanna",
  normalizedAliases: ["robyn rihanna fenty"],
  normalizedName: "rihanna",
  providerIdentities: [],
  slug: "rihanna",
};
const ITEM: VersoSearchRepositoryItem = {
  addedAt: new Date("2027-05-04T12:00:00.000Z"),
  assetId: "64b000000000000000000001",
  associations: [
    {
      confidence: 99.4,
      decision: "APPROVED",
      displayName: "Rihanna",
      evidenceFields: [],
      identityKey: "rihanna",
      providerPersonId: "person-rihanna",
      searchDecision: "APPROVED",
      source: "recognition",
    },
    {
      confidence: 65,
      decision: "APPROVED",
      displayName: "Other Person",
      evidenceFields: [],
      identityKey: "other-person",
      providerPersonId: "person-other",
      searchDecision: "NEEDS_REVIEW",
      source: "recognition",
    },
  ],
  event: "met-gala",
  eventName: "Met Gala",
  galleryId: "met-gala-2027",
  mimeType: "image/jpeg",
  originalFilename: "rihanna.jpg",
  sourceText: {
    altText: "Rihanna on the red carpet",
    caption: "Rihanna arrives at the Met Gala",
    title: "Rihanna",
  },
  year: 2027,
};

function createHarness(options: {
  identityMatches?: CelebrityCatalogEntry[];
  repositoryPage?: Awaited<ReturnType<VersoSearchRepository["findApprovedCelebrityUsages"]>>;
  slugMatch?: CelebrityCatalogEntry | null;
} = {}) {
  const celebrityRepository: CelebrityLookupRepository = {
    findByNormalizedIdentity: vi.fn(async () => options.identityMatches ?? [RIHANNA]),
    findBySlug: vi.fn(async () => options.slugMatch === undefined ? RIHANNA : options.slugMatch),
  };
  const searchRepository: VersoSearchRepository = {
    findApprovedCelebrityUsages: vi.fn(async () =>
      options.repositoryPage ?? { hasMore: false, items: [ITEM] },
    ),
  };
  const service = new VersoSearchService({ celebrityRepository, searchRepository });

  return { celebrityRepository, searchRepository, service };
}

describe("VersoSearchService", () => {
  it("resolves aliases and maps approved public search results", async () => {
    const { celebrityRepository, searchRepository, service } = createHarness();

    await expect(
      service.search({
        event: "met-gala",
        limit: 20,
        query: "Robyn Rihanna Fenty",
        year: 2027,
      }),
    ).resolves.toEqual({
      celebrity: { displayName: "Rihanna", slug: "rihanna" },
      items: [
        {
          assetId: ITEM.assetId,
          celebrities: [{ displayName: "Rihanna", slug: "rihanna" }],
          event: { id: "met-gala", name: "Met Gala", year: 2027 },
          links: {
            image: `/api/assets/${ITEM.assetId}/image`,
            self: `/api/assets/${ITEM.assetId}`,
          },
          mimeType: "image/jpeg",
          originalFilename: "rihanna.jpg",
          sourceGallery: {
            addedAt: "2027-05-04T12:00:00.000Z",
            galleryId: "met-gala-2027",
          },
          sourceText: ITEM.sourceText,
        },
      ],
      nextCursor: null,
      query: "Robyn Rihanna Fenty",
    });

    expect(celebrityRepository.findByNormalizedIdentity).toHaveBeenCalledWith(
      "robyn rihanna fenty",
    );
    expect(searchRepository.findApprovedCelebrityUsages).toHaveBeenCalledWith({
      celebritySlug: "rihanna",
      cursor: undefined,
      decisionEngineVersion: 2,
      filters: { event: "met-gala", year: 2027 },
      limit: 20,
    });
  });

  it("returns an empty resolved response for an unknown query", async () => {
    const { searchRepository, service } = createHarness({ identityMatches: [] });

    await expect(service.search({ limit: 20, query: "Unknown Person" })).resolves.toEqual({
      celebrity: null,
      items: [],
      nextCursor: null,
      query: "Unknown Person",
    });
    expect(searchRepository.findApprovedCelebrityUsages).not.toHaveBeenCalled();
  });

  it("rejects an alias shared by multiple celebrities", async () => {
    const { searchRepository, service } = createHarness({
      identityMatches: [RIHANNA, { ...RIHANNA, displayName: "Another Rihanna", slug: "another-rihanna" }],
    });

    await expect(service.search({ limit: 20, query: "shared alias" })).rejects.toMatchObject({
      code: "AMBIGUOUS_CELEBRITY_QUERY",
      statusCode: 409,
    });
    expect(searchRepository.findApprovedCelebrityUsages).not.toHaveBeenCalled();
  });

  it("returns a canonical celebrity archive and reports missing slugs", async () => {
    const existing = createHarness();
    await expect(
      existing.service.getCelebrityArchive("rihanna", { limit: 20 }),
    ).resolves.toMatchObject({
      celebrity: { displayName: "Rihanna", slug: "rihanna" },
      items: [{ assetId: ITEM.assetId }],
    });
    expect(existing.celebrityRepository.findBySlug).toHaveBeenCalledWith("rihanna");

    const missing = createHarness({ slugMatch: null });
    await expect(
      missing.service.getCelebrityArchive("missing", { limit: 20 }),
    ).rejects.toMatchObject({ code: "CELEBRITY_NOT_FOUND", statusCode: 404 });
    expect(missing.searchRepository.findApprovedCelebrityUsages).not.toHaveBeenCalled();
  });

  it("creates a stable cursor and rejects reuse with different filters", async () => {
    const firstPage = createHarness({
      repositoryPage: { hasMore: true, items: [ITEM] },
    });
    const response = await firstPage.service.search({
      event: "met-gala",
      limit: 1,
      query: "Rihanna",
      year: 2027,
    });
    expect(response.nextCursor).toEqual(expect.any(String));

    await firstPage.service.search({
      cursor: response.nextCursor!,
      event: "met-gala",
      limit: 1,
      query: "Rihanna",
      year: 2027,
    });
    expect(firstPage.searchRepository.findApprovedCelebrityUsages).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cursor: {
          addedAt: ITEM.addedAt,
          assetId: ITEM.assetId,
          galleryId: ITEM.galleryId,
        },
      }),
    );

    await expect(
      firstPage.service.search({
        cursor: response.nextCursor!,
        event: "oscars",
        limit: 1,
        query: "Rihanna",
        year: 2027,
      }),
    ).rejects.toMatchObject({ code: "INVALID_SEARCH_CURSOR", statusCode: 400 });
  });

  it("rejects malformed cursors", async () => {
    const { service } = createHarness();

    await expect(
      service.getCelebrityArchive("rihanna", { cursor: "not-a-cursor", limit: 20 }),
    ).rejects.toMatchObject({ code: "INVALID_SEARCH_CURSOR", statusCode: 400 });
  });
});
