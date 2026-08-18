import { describe, expect, it, vi } from "vitest";

import type { GalleryUsageRepository } from "../../server/repositories/GalleryUsageRepository.js";
import { GalleryService } from "../../server/services/GalleryService.js";

const FIRST_ASSET_ID = "64b000000000000000000001";
const SECOND_ASSET_ID = "64b000000000000000000002";
const NOW = new Date("2027-05-04T12:00:00.000Z");

function createDependencies(
  overrides: {
    existingAssetIds?: Set<string>;
    usageRepository?: GalleryUsageRepository;
  } = {},
) {
  const usageRepository = overrides.usageRepository ?? {
    removeAsset: vi.fn(async () => false),
    syncGallery: vi.fn(async () => undefined),
  };
  const assetRepository = {
    findExistingAssetIds: vi.fn(
      async (assetIds: readonly string[]) => overrides.existingAssetIds ?? new Set(assetIds),
    ),
  };

  return { assetRepository, usageRepository };
}

describe("GalleryService", () => {
  it("persists canonical event context", async () => {
    const dependencies = createDependencies();
    const service = new GalleryService({ ...dependencies, clock: () => NOW });

    await expect(
      service.syncContext("gallery-1", {
        assetIds: [FIRST_ASSET_ID, SECOND_ASSET_ID],
        published: true,
        tags: ["fashion", "Met Gala 2027", "storytype:news-and-trending"],
      }),
    ).resolves.toEqual({
      assetCount: 2,
      event: { id: "met-gala", name: "Met Gala", year: 2027 },
      galleryId: "gallery-1",
      published: true,
    });

    expect(dependencies.assetRepository.findExistingAssetIds).toHaveBeenCalledWith([
      FIRST_ASSET_ID,
      SECOND_ASSET_ID,
    ]);
    expect(dependencies.usageRepository.syncGallery).toHaveBeenCalledWith({
      assetIds: [FIRST_ASSET_ID, SECOND_ASSET_ID],
      event: "met-gala",
      eventName: "Met Gala",
      galleryId: "gallery-1",
      published: true,
      updatedAt: NOW,
      year: 2027,
    });
  });

  it("keeps gallery relationships when tags do not identify an event", async () => {
    const dependencies = createDependencies();
    const service = new GalleryService({ ...dependencies, clock: () => NOW });

    await expect(
      service.syncContext("gallery-1", {
        assetIds: [FIRST_ASSET_ID],
        published: false,
        tags: ["fashion"],
      }),
    ).resolves.toMatchObject({ event: null });
    expect(dependencies.usageRepository.syncGallery).toHaveBeenCalledWith(
      expect.objectContaining({ event: null, eventName: null, year: null }),
    );
  });

  it("rejects ambiguous tags before reading or writing assets", async () => {
    const dependencies = createDependencies();
    const service = new GalleryService(dependencies);

    const result = service.syncContext("gallery-1", {
      assetIds: [FIRST_ASSET_ID],
      published: true,
      tags: ["Met Gala 2027", "Oscars 2027"],
    });

    await expect(result).rejects.toMatchObject({
      code: "AMBIGUOUS_GALLERY_EVENT",
      statusCode: 400,
    });
    expect(dependencies.assetRepository.findExistingAssetIds).not.toHaveBeenCalled();
    expect(dependencies.usageRepository.syncGallery).not.toHaveBeenCalled();
  });

  it("rejects a snapshot containing missing assets before changing usages", async () => {
    const dependencies = createDependencies({ existingAssetIds: new Set([FIRST_ASSET_ID]) });
    const service = new GalleryService(dependencies);

    const result = service.syncContext("gallery-1", {
      assetIds: [FIRST_ASSET_ID, SECOND_ASSET_ID],
      published: true,
      tags: ["Met Gala 2027"],
    });

    await expect(result).rejects.toMatchObject({
      code: "GALLERY_ASSET_NOT_FOUND",
      statusCode: 404,
    });
    expect(dependencies.usageRepository.syncGallery).not.toHaveBeenCalled();
  });

  it("removes an asset idempotently", async () => {
    const usageRepository: GalleryUsageRepository = {
      removeAsset: vi.fn(async () => true),
      syncGallery: vi.fn(async () => undefined),
    };
    const service = new GalleryService(createDependencies({ usageRepository }));

    await expect(service.removeAsset("gallery-1", FIRST_ASSET_ID)).resolves.toEqual({
      assetId: FIRST_ASSET_ID,
      galleryId: "gallery-1",
      removed: true,
    });
    expect(usageRepository.removeAsset).toHaveBeenCalledWith("gallery-1", FIRST_ASSET_ID);
  });

  it("serializes concurrent snapshots for the same gallery", async () => {
    let releaseFirst!: () => void;
    const firstWrite = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const syncGallery = vi
      .fn<GalleryUsageRepository["syncGallery"]>()
      .mockImplementationOnce(() => firstWrite)
      .mockResolvedValue(undefined);
    const dependencies = createDependencies({
      usageRepository: {
        removeAsset: vi.fn(async () => false),
        syncGallery,
      },
    });
    const service = new GalleryService(dependencies);

    const first = service.syncContext("gallery-1", {
      assetIds: [FIRST_ASSET_ID],
      published: false,
      tags: ["Met Gala 2026"],
    });
    const second = service.syncContext("gallery-1", {
      assetIds: [SECOND_ASSET_ID],
      published: true,
      tags: ["Met Gala 2027"],
    });

    await vi.waitFor(() => expect(syncGallery).toHaveBeenCalledTimes(1));
    releaseFirst();
    await Promise.all([first, second]);

    expect(syncGallery).toHaveBeenCalledTimes(2);
    expect(syncGallery.mock.calls[1][0]).toMatchObject({
      assetIds: [SECOND_ASSET_ID],
      published: true,
      year: 2027,
    });
  });
});
