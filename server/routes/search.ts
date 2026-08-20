import { Router } from "express";

import {
  celebrityArchiveQuerySchema,
  celebritySearchQuerySchema,
  celebritySlugSchema,
  discoveryHubQuerySchema,
} from "../../shared/search.js";
import type { VersoSearchService } from "../services/VersoSearchService.js";

export type VersoSearchRouteService = Pick<
  VersoSearchService,
  "getCelebrityArchive" | "getDiscoveryHub" | "search"
>;

export function createVersoSearchRouter(searchService: VersoSearchRouteService): Router {
  const searchRouter = Router();

  searchRouter.get("/discovery", async (request, response) => {
    const query = discoveryHubQuerySchema.parse(request.query);
    response.json(await searchService.getDiscoveryHub(query));
  });

  searchRouter.get("/search", async (request, response) => {
    const query = celebritySearchQuerySchema.parse(request.query);
    response.json(await searchService.search(query));
  });

  searchRouter.get("/celebrities/:celebritySlug", async (request, response) => {
    const celebritySlug = celebritySlugSchema.parse(request.params.celebritySlug);
    const query = celebrityArchiveQuerySchema.parse(request.query);
    response.json(await searchService.getCelebrityArchive(celebritySlug, query));
  });

  return searchRouter;
}
