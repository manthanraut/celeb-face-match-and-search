import express from "express";

import { apiRouter } from "./routes/api.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", apiRouter);

  return app;
}
