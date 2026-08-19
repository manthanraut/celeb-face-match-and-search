import express, { type Express } from "express";

import { allowAllCors } from "./middleware/cors.js";
import { createApiRouter, type ApiRouterDependencies } from "./routes/api.js";

export function createApp(dependencies: ApiRouterDependencies): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(allowAllCors);
  app.use("/api", createApiRouter(dependencies));

  return app;
}
