import express, { Router } from "express";

import { apiNotFoundHandler } from "../middleware/api-not-found.js";
import { apiErrorHandler } from "../middleware/error-handler.js";
import { createAssetRouter, type AssetRouteService } from "./assets.js";

export interface ApiRouterDependencies {
  assetService: AssetRouteService;
  checkDatabaseReadiness: () => Promise<void>;
  recognitionProvider: "aws-rekognition";
}

export function createApiRouter({
  assetService,
  checkDatabaseReadiness,
  recognitionProvider,
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

  apiRouter.use(apiNotFoundHandler);
  apiRouter.use(apiErrorHandler);

  return apiRouter;
}
