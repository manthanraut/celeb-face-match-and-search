import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../server/app.js";
import type { GalleryRouteService } from "../../server/routes/galleries.js";
import { createUnusedAssetRouteService } from "../helpers/asset-route-service.js";
import { startTestHttpServer } from "../helpers/http-server.js";
import { createUnusedVersoSearchRouteService } from "../helpers/verso-search-route-service.js";

const ASSET_ID = "64b000000000000000000001";

function createGalleryService(overrides: Partial<GalleryRouteService> = {}): GalleryRouteService {
  return {
    removeAsset: vi.fn(async (galleryId, assetId) => ({
      assetId,
      galleryId,
      removed: true,
    })),
    syncContext: vi.fn(async (galleryId, update) => ({
      assetCount: update.assetIds.length,
      event: { id: "met-gala" as const, name: "Met Gala", year: 2027 },
      galleryId,
      published: update.published,
    })),
    ...overrides,
  };
}

async function startGalleryApi(galleryService: GalleryRouteService) {
  return startTestHttpServer(
    createApp({
      assetService: createUnusedAssetRouteService(),
      checkDatabaseReadiness: () => Promise.resolve(),
      galleryService,
      recognitionProvider: "aws-rekognition",
      versoSearchService: createUnusedVersoSearchRouteService(),
    }),
  );
}

describe("gallery API", () => {
  it("syncs a complete gallery context snapshot", async () => {
    const galleryService = createGalleryService();
    const testServer = await startGalleryApi(galleryService);
    const update = {
      assetIds: [ASSET_ID],
      published: true,
      tags: ["fashion", "Met Gala 2027"],
    };

    try {
      const response = await fetch(`${testServer.baseUrl}/api/galleries/gallery-1/context`, {
        body: JSON.stringify(update),
        headers: { "content-type": "application/json" },
        method: "PUT",
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        assetCount: 1,
        event: { id: "met-gala", name: "Met Gala", year: 2027 },
        galleryId: "gallery-1",
        published: true,
      });
      expect(galleryService.syncContext).toHaveBeenCalledWith("gallery-1", update);
    } finally {
      await testServer.close();
    }
  });

  it("rejects duplicate assets and does not call the service", async () => {
    const galleryService = createGalleryService();
    const testServer = await startGalleryApi(galleryService);

    try {
      const response = await fetch(`${testServer.baseUrl}/api/galleries/gallery-1/context`, {
        body: JSON.stringify({
          assetIds: [ASSET_ID, ASSET_ID],
          published: true,
          tags: ["Met Gala 2027"],
        }),
        headers: { "content-type": "application/json" },
        method: "PUT",
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "VALIDATION_ERROR" },
      });
      expect(galleryService.syncContext).not.toHaveBeenCalled();
    } finally {
      await testServer.close();
    }
  });

  it("removes an asset from a gallery", async () => {
    const galleryService = createGalleryService();
    const testServer = await startGalleryApi(galleryService);

    try {
      const response = await fetch(
        `${testServer.baseUrl}/api/galleries/gallery-1/assets/${ASSET_ID}`,
        { method: "DELETE" },
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        assetId: ASSET_ID,
        galleryId: "gallery-1",
        removed: true,
      });
      expect(galleryService.removeAsset).toHaveBeenCalledWith("gallery-1", ASSET_ID);
    } finally {
      await testServer.close();
    }
  });
});
