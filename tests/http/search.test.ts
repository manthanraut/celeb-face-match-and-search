import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../server/app.js";
import type { VersoSearchRouteService } from "../../server/routes/search.js";
import { createUnusedAssetRouteService } from "../helpers/asset-route-service.js";
import { createUnusedGalleryRouteService } from "../helpers/gallery-route-service.js";
import { startTestHttpServer } from "../helpers/http-server.js";

function createSearchService(): VersoSearchRouteService {
  return {
    getCelebrityArchive: vi.fn(async (celebritySlug) => ({
      celebrity: { displayName: "Rihanna", slug: celebritySlug },
      items: [],
      nextCursor: null,
      total_count: 0,
    })),
    search: vi.fn(async (query) => ({
      celebrity: { displayName: "Rihanna", slug: "rihanna" },
      items: [],
      nextCursor: null,
      query: query.query,
      total_count: 0,
    })),
  };
}

async function startSearchApi(versoSearchService: VersoSearchRouteService) {
  return startTestHttpServer(
    createApp({
      assetService: createUnusedAssetRouteService(),
      checkDatabaseReadiness: () => Promise.resolve(),
      galleryService: createUnusedGalleryRouteService(),
      recognitionProvider: "aws-rekognition",
      versoSearchService,
    }),
  );
}

describe("Verso search API", () => {
  it("validates and delegates celebrity search filters", async () => {
    const service = createSearchService();
    const testServer = await startSearchApi(service);

    try {
      const response = await fetch(
        `${testServer.baseUrl}/api/search?query=%20Rihanna%20&event=met-gala&year=2027&limit=12`,
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        celebrity: { slug: "rihanna" },
        query: "Rihanna",
        total_count: 0,
      });
      expect(service.search).toHaveBeenCalledWith({
        event: "met-gala",
        limit: 12,
        query: "Rihanna",
        year: 2027,
      });
    } finally {
      await testServer.close();
    }
  });

  it("returns validation errors for missing queries and unsupported events", async () => {
    const service = createSearchService();
    const testServer = await startSearchApi(service);

    try {
      const missingQuery = await fetch(`${testServer.baseUrl}/api/search`);
      const invalidEvent = await fetch(
        `${testServer.baseUrl}/api/search?query=Rihanna&event=cannes`,
      );

      expect(missingQuery.status).toBe(400);
      expect(invalidEvent.status).toBe(400);
      expect(service.search).not.toHaveBeenCalled();
    } finally {
      await testServer.close();
    }
  });

  it("returns a filtered celebrity archive with default pagination", async () => {
    const service = createSearchService();
    const testServer = await startSearchApi(service);

    try {
      const response = await fetch(
        `${testServer.baseUrl}/api/celebrities/rihanna?event=oscars&year=2026`,
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        celebrity: { slug: "rihanna" },
        items: [],
        total_count: 0,
      });
      expect(service.getCelebrityArchive).toHaveBeenCalledWith("rihanna", {
        event: "oscars",
        limit: 20,
        year: 2026,
      });
    } finally {
      await testServer.close();
    }
  });

  it("rejects invalid celebrity slugs before calling the service", async () => {
    const service = createSearchService();
    const testServer = await startSearchApi(service);

    try {
      const response = await fetch(`${testServer.baseUrl}/api/celebrities/Rihanna!`);

      expect(response.status).toBe(400);
      expect(service.getCelebrityArchive).not.toHaveBeenCalled();
    } finally {
      await testServer.close();
    }
  });
});
