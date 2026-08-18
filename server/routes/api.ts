import express, { Router } from "express";

import type { RecognitionProviderName } from "../../shared/contracts/recognition.js";
import { apiNotFoundHandler } from "../middleware/api-not-found.js";
import { apiErrorHandler } from "../middleware/error-handler.js";
import { createAssetRouter, type AssetRouteService } from "./assets.js";
import { createGalleryRouter, type GalleryRouteService } from "./galleries.js";
import { createVersoSearchRouter, type VersoSearchRouteService } from "./search.js";

export interface ApiRouterDependencies {
  assetService: AssetRouteService;
  checkDatabaseReadiness: () => Promise<void>;
  galleryService: GalleryRouteService;
  recognitionProvider: RecognitionProviderName;
  versoSearchService: VersoSearchRouteService;
}

export function createApiRouter({
  assetService,
  checkDatabaseReadiness,
  galleryService,
  recognitionProvider,
  versoSearchService,
}: ApiRouterDependencies): Router {
  const apiRouter = Router();

  apiRouter.use(express.json({ limit: "1mb" }));

  apiRouter.get("/health", (_request, response) => {
    response.json({
      status: "ok",
      recognitionProvider,
    });
  });

  apiRouter.get("/ready", async (_request, response) => {
    try {
      await checkDatabaseReadiness();
      response.json({
        status: "ready",
        checks: {
          database: "up",
        },
      });
    } catch {
      response.status(503).json({
        status: "not-ready",
        checks: {
          database: "down",
        },
      });
    }
  });

  apiRouter.use("/assets", createAssetRouter(assetService));
  apiRouter.use("/galleries", createGalleryRouter(galleryService));
  apiRouter.use(createVersoSearchRouter(versoSearchService));

  apiRouter.use(apiNotFoundHandler);
  apiRouter.use(apiErrorHandler);

  return apiRouter;
}
